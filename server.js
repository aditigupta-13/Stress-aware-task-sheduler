const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const usersFile = path.join(__dirname, "Backend", "users.txt");
const stressHistoryFile = path.join(__dirname, "Backend", "stress_history.txt");

function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
}

function clamp01(x) {
    return clamp(x, 0, 1);
}

function fmt2(n) {
    return Number(n).toFixed(2);
}

/** ISO date YYYY-MM-DD plus delta days (UTC calendar math). */
function addDaysISO(isoDateStr, deltaDays) {
    const parts = String(isoDateStr || "").trim().split("-").map((x) => Number(x));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "";
    const [y, m, d] = parts;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(dt.getTime())) return "";
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return dt.toISOString().slice(0, 10);
}

function formatHourLabel(totalHoursFromMidnight) {
    const h = Math.floor(totalHoursFromMidnight);
    const m = Math.round((totalHoursFromMidnight - h) * 60);
    const hh = String((h % 24 + 24) % 24).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
}

function buildSmartTimetable(tasksRaw) {
    const tasks = (Array.isArray(tasksRaw) ? tasksRaw : [])
        .map((t) => ({
            name: String(t?.name || "").trim(),
            duration: Number(t?.time)
        }))
        .filter((t) => t.name && Number.isFinite(t.duration) && t.duration > 0)
        .sort((a, b) => a.duration - b.duration);

    if (!tasks.length) return "No tasks found.\n";

    let currentHour = 9;
    let out = "---- SMART TIMETABLE ----\n\n";
    tasks.forEach((task, index) => {
        const endHour = currentHour + task.duration;
        out += `${task.name} : ${formatHourLabel(currentHour)} - ${formatHourLabel(endHour)}\n`;
        currentHour = endHour;

        if (index !== tasks.length - 1) {
            const breakEnd = currentHour + 1;
            out += `Break : ${formatHourLabel(currentHour)} - ${formatHourLabel(breakEnd)}\n`;
            currentHour = breakEnd;
        }
    });
    return out;
}

function calculateStressScore(payload) {
    const moodHistoryRaw = Array.isArray(payload?.moodHistory) ? payload.moodHistory : [];
    const moodHistory = moodHistoryRaw
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x))
        .map((x) => clamp(x, 1, 5));
    const sleepHours = clamp(Number(payload?.sleepHours), 0, 24);
    const taskCompletion = payload?.taskCompletion || {};
    const completed = Number(taskCompletion.completed ?? 0);
    const total = Number(taskCompletion.total ?? 0);

    if (!moodHistory.length) {
        return { error: "moodHistory is required (numbers)" };
    }
    if (!Number.isFinite(Number(payload?.sleepHours))) {
        return { error: "sleepHours must be valid (0-24)" };
    }
    if (!Number.isFinite(total) || total < 0) {
        return { error: "taskCompletion.total must be valid (>=0)" };
    }
    if (!Number.isFinite(completed) || completed < 0) {
        return { error: "taskCompletion.completed must be valid (>=0)" };
    }

    const moodAvg = moodHistory.reduce((a, b) => a + b, 0) / moodHistory.length;
    const moodStress01 = clamp01((moodAvg - 1) / 4);
    const sleepStress01 = clamp01((8 - sleepHours) / 8);
    const completionRatio = total === 0 ? 0 : clamp01(completed / total);
    const completionStress01 = clamp01(1 - completionRatio);

    const moodComponent = Math.round(moodStress01 * 100 * 0.4);
    const sleepComponent = Math.round(sleepStress01 * 100 * 0.3);
    const completionComponent = Math.round(completionStress01 * 100 * 0.3);
    const score = Math.round(clamp(moodComponent + sleepComponent + completionComponent, 0, 100));

    return {
        score,
        components: {
            mood: moodComponent,
            sleep: sleepComponent,
            completion: completionComponent
        },
        moodAvg: Number(fmt2(moodAvg)),
        moodStress: Math.round(moodStress01 * 100),
        sleepHours: Number(fmt2(sleepHours)),
        sleepStress: Math.round(sleepStress01 * 100),
        completionRatio: Number(fmt2(completionRatio)),
        completionStress: Math.round(completionStress01 * 100),
        formula: {
            weights: { mood: 0.4, sleep: 0.3, completion: 0.3 },
            mapping: {
                moodAvgToStress01: "(moodAvg - 1) / 4",
                sleepStress01: "(8 - sleepHours) / 8",
                completionStress01: "1 - completed/total"
            }
        }
    };
}

async function generateWeeklyReport(endDate, calendarDays = 7) {
    let existing = "";
    try {
        existing = await fs.readFile(stressHistoryFile, "utf8");
    } catch (e) {
        if (e && e.code === "ENOENT") {
            return { error: "stress_history.txt not found. Record stress scores first." };
        }
        throw e;
    }

    const filtered = existing
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => line.split("|").map((p) => String(p || "").trim()))
        .filter((parts) => parts.length >= 3)
        .map((parts) => ({
            date: parts[0],
            score: Number(parts[1]),
            moodAvg: Number(parts[2])
        }))
        .filter((d) => d.date && Number.isFinite(d.score) && Number.isFinite(d.moodAvg))
        .filter((d) => !endDate || d.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (!filtered.length) {
        return { error: "No stress history found. Calculate a stress score first to create history." };
    }

    const endDateStr = String(endDate || "").trim();
    const days = Math.max(1, Math.min(31, Number(calendarDays) || 7));
    const windowStart = endDateStr ? addDaysISO(endDateStr, -(days - 1)) : "";

    if (!endDateStr || !windowStart) {
        return { error: "Invalid endDate (expected YYYY-MM-DD)." };
    }

    // Only entries inside the rolling calendar window [windowStart, endDateStr].
    const week = filtered.filter((d) => d.date >= windowStart && d.date <= endDateStr);

    if (!week.length) {
        const last = filtered[filtered.length - 1];
        const lastHint = last ? ` Your most recent saved entry is ${last.date}.` : "";
        return {
            error:
                `No stress data between ${windowStart} and ${endDateStr}.${lastHint} ` +
                `Use “Calculate Stress Score” on those days to fill this week, then generate again.`
        };
    }

    const avgMood = week.reduce((sum, d) => sum + d.moodAvg, 0) / week.length;
    const cumulativeScores = [];
    week.reduce((acc, d) => {
        const next = acc + d.score;
        cumulativeScores.push(next);
        return next;
    }, 0);

    const delta = week[week.length - 1].score - week[0].score;
    let trend = "stable";
    if (delta > 10) trend = "up";
    else if (delta < -10) trend = "down";

    const topStressDays = [...week]
        .sort((a, b) => (b.score - a.score) || b.date.localeCompare(a.date))
        .slice(0, 3)
        .map((d) => ({ date: d.date, score: d.score }));

    return {
        calendarWindow: {
            startDate: windowStart,
            endDate: endDateStr,
            days: days
        },
        week: {
            startDate: week[0].date,
            endDate: week[week.length - 1].date,
            count: week.length
        },
        avgMood: Number(fmt2(avgMood)),
        stressTrend: {
            trend,
            days: week.map((d) => ({ date: d.date, score: d.score })),
            cumulativeScores
        },
        topStressDays
    };
}

async function loadUsers() {
    // File format: "<user> <pass>" per line.
    // If file doesn't exist yet, treat it as empty.
    let content = "";
    try {
        content = await fs.readFile(usersFile, "utf8");
    } catch (e) {
        if (e && e.code === "ENOENT") return new Map();
        throw e;
    }

    const users = new Map();
    for (const line of content.split(/\r?\n/)) {
        const trimmed = String(line).trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) continue;
        const user = parts[0];
        const pass = parts[1];
        users.set(user, pass);
    }
    return users;
}

async function appendUser(user, pass) {
    // Append to users.txt atomically-ish for this simple project.
    // (Assumes low concurrency.)
    await fs.appendFile(usersFile, `${user} ${pass}\n`, "utf8");
}

app.post("/register", async (req, res) => {
    try {
        const user = String(req.body?.user || "").trim();
        const pass = String(req.body?.pass || "").trim();

        if (!user || !pass) {
            return res.status(400).send("Missing user or pass");
        }

        const users = await loadUsers();
        if (users.has(user)) {
            return res.status(409).send("User already exists");
        }

        await appendUser(user, pass);
        return res.send("Register success");
    } catch (err) {
        console.error(err);
        return res.status(500).send("Server error");
    }
});

app.post("/login", async (req, res) => {
    try {
        const user = String(req.body?.user || "").trim();
        const pass = String(req.body?.pass || "").trim();

        if (!user || !pass) {
            return res.status(400).send("Missing user or pass");
        }

        const users = await loadUsers();
        const ok = users.get(user) === pass;
        if (!ok) return res.send("Invalid credentials");

        return res.send("Login success");
    } catch (err) {
        console.error(err);
        return res.status(500).send("Server error");
    }
});

app.get("/breathing/stream", (req, res) => {
    // Server-Sent Events (SSE) stream for inhale/exhale timer.
    const stressLevel = String(req.query.stressLevel || "normal");

    const configByStress = {
        calm: { inhaleSec: 4, exhaleSec: 4, cycles: 5 },
        normal: { inhaleSec: 4, exhaleSec: 5, cycles: 5 },
        stressed: { inhaleSec: 4, exhaleSec: 6, cycles: 5 },
        very_stressed: { inhaleSec: 4, exhaleSec: 7, cycles: 6 }
    };

    const cfg = configByStress[stressLevel] || configByStress.normal;
    const inhaleSec = Number(cfg.inhaleSec);
    const exhaleSec = Number(cfg.exhaleSec);
    const cycles = Number(cfg.cycles);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (eventName, data) => {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send("started", { inhaleSec, exhaleSec, cycles, stressLevel });

    // State machine: inhale/exhale alternating for `cycles` complete pairs.
    let cycle = 1;
    let phase = "inhale"; // "inhale" | "exhale"
    let phaseDurationSec = phase === "inhale" ? inhaleSec : exhaleSec;
    let phaseEndsAt = Date.now() + phaseDurationSec * 1000;
    let lastRemainingSec = null;
    let finished = false;

    // Use interval to keep both the timer and phase transitions accurate.
    const interval = setInterval(() => {
        if (finished) return;

        const now = Date.now();
        const remainingMs = Math.max(0, phaseEndsAt - now);
        const remainingSec = Math.ceil(remainingMs / 1000);

        if (remainingSec !== lastRemainingSec) {
            lastRemainingSec = remainingSec;
            send("tick", { phase, cycle, remainingSec });
        }

        if (remainingMs <= 0) {
            // Advance state.
            if (phase === "inhale") {
                phase = "exhale";
                phaseDurationSec = exhaleSec;
                phaseEndsAt = Date.now() + phaseDurationSec * 1000;
                send("phaseChange", { phase, cycle, nextDurationSec: phaseDurationSec });
            } else {
                // completed one cycle (inhale + exhale)
                if (cycle >= cycles) {
                    finished = true;
                    clearInterval(interval);
                    send("done", { completed: true });
                    res.end();
                    return;
                }
                cycle += 1;
                phase = "inhale";
                phaseDurationSec = inhaleSec;
                phaseEndsAt = Date.now() + phaseDurationSec * 1000;
                send("phaseChange", { phase, cycle, nextDurationSec: phaseDurationSec });
            }
        }
    }, 200);

    req.on("close", () => {
        finished = true;
        clearInterval(interval);
    });
});

app.post("/generate", async (req, res) => {
    try {
        const output = buildSmartTimetable(req.body?.tasks || []);
        return res.send(output);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

app.post("/stress/score", async (req, res) => {
    try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const dateStr = String(req.body?.date || todayStr).trim();

        const parsed = calculateStressScore(req.body || {});
        if (parsed?.error) return res.status(400).send(parsed.error);

        // Persist one stress record per date for weekly reporting.
        let existing = "";
        try {
            existing = await fs.readFile(stressHistoryFile, "utf8");
        } catch (e) {
            if (e && e.code !== "ENOENT") throw e;
        }

        const histLine =
            `${dateStr}|${parsed.score}|${parsed.moodAvg}|${parsed.sleepHours}|${parsed.completionRatio}`.trim();
        const lines = existing
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean)
            .filter(l => !l.startsWith(`${dateStr}|`));

        lines.push(histLine);
        await fs.writeFile(stressHistoryFile, lines.join("\n") + "\n", "utf8");
        return res.send(JSON.stringify(parsed));
    } catch (err) {
        console.error(err);
        return res.status(500).send("Server error");
    }
});

app.get("/stress/weekly-report", async (req, res) => {
    try {
        const endDate = String(req.query?.endDate || new Date().toISOString().slice(0, 10)).trim();
        const calendarDays = Number(req.query?.calendarDays ?? req.query?.count ?? 7);
        const report = await generateWeeklyReport(endDate, calendarDays);
        return res.send(JSON.stringify(report));
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});