document.addEventListener("DOMContentLoaded", () => {
    const tasksKey = "tasks";
    const userKey = "user";
    const scheduleKey = "schedule";
    const stressKey = "stressLevel";
    const weeklyReportKey = "weeklyReport";
    const stressScoreKey = "stressScoreOutput";
    let tasks = JSON.parse(localStorage.getItem(tasksKey)) || [];

    const $welcome = document.getElementById("welcome");
    const $taskList = document.getElementById("taskList");
    const $taskInput = document.getElementById("taskInput");
    const $taskTime = document.getElementById("taskTime");
    const $addBtn = document.getElementById("addBtn");
    const $generateBtn = document.getElementById("generateBtn");
    const $schedule = document.getElementById("schedule");
    const $taskForm = document.getElementById("taskForm");
    const $logoutBtn = document.getElementById("logoutBtn");
    const $progressText = document.getElementById("progressText");
    const $progressBarText = document.getElementById("progressBarText");
    const $stressLevel = document.getElementById("stressLevel");
    const $stressTip = document.getElementById("stressTip");
    const $breathStartBtn = document.getElementById("breathStartBtn");
    const $breathStopBtn = document.getElementById("breathStopBtn");
    const $breathPhaseText = document.getElementById("breathPhaseText");
    const $breathCountdownText = document.getElementById("breathCountdownText");
    const $breathOrb = document.getElementById("breathOrb");
    const $breathInstruction = document.getElementById("breathInstruction");
    const $moodHistoryInput = document.getElementById("moodHistoryInput");
    const $sleepHoursInput = document.getElementById("sleepHoursInput");
    const $calcStressBtn = document.getElementById("calcStressBtn");
    const $stressScoreOutput = document.getElementById("stressScoreOutput");
    const $weeklyReportBtn = document.getElementById("weeklyReportBtn");
    const $weeklyReportOutput = document.getElementById("weeklyReportOutput");
    const $stressMeterValue = document.getElementById("stressMeterValue");
    const $stressMeterFill = document.getElementById("stressMeterFill");
    const $breakoutCards = document.getElementById("breakoutCards");
    // Backend base URL.
    // - If this file is opened directly as `file://...`, `window.location.protocol` is "file:"
    //   and a computed URL like "file://:3000" is invalid. In that case, default to localhost.
    // - If served over http(s), use the current host (supports opening via IP/hostname).
    const apiBase = (() => {
        const proto = String(window.location.protocol || "").toLowerCase();
        const host = String(window.location.hostname || "").trim();
        if (proto === "file:" || !host) return "http://localhost:3000";
        return `${proto}//${host}:3000`;
    })();

    /** Today's date in local timezone as YYYY-MM-DD (not UTC). */
    function localTodayISO() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function formatWeeklyReport(report) {
        if (report?.error) return String(report.error);

        const win = report?.calendarWindow;
        const windowLine = win
            ? `Report window: ${win.startDate} → ${win.endDate} (${win.days} calendar days)`
            : "";
        const dataLine = report?.week
            ? `Days with saved scores: ${report.week.count}`
            : "";

        const trendDays = (report?.stressTrend?.days || [])
            .map((d) => `  ${d.date}: ${d.score}`)
            .join("\n");
        const topDays = (report?.topStressDays || [])
            .map((d, i) => `  ${i + 1}. ${d.date} (${d.score})`)
            .join("\n");

        const noDataInWindow =
            !trendDays &&
            "  (none — calculate stress scores for days in this week.)";

        return (
            `${windowLine}\n` +
            `${dataLine}\n` +
            `Average mood: ${report?.avgMood ?? "—"}\n` +
            `Trend: ${report?.stressTrend?.trend ?? "—"}\n\n` +
            `Daily stress scores:\n${trendDays || noDataInWindow}\n\n` +
            `Top stress days:\n${topDays || "  (none)"}`
        );
    }

    const dashboardMock = {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        productivityTasks: [5, 7, 4, 8, 6, 3, 5],
        productivityHours: [3.2, 4.1, 2.8, 4.5, 3.9, 2.4, 3.0],
        moodLevels: [6, 7, 5, 8, 7, 4, 6]
    };
    let productivityChart = null;
    let moodChart = null;

    $welcome.innerText = `Hello ${localStorage.getItem(userKey) || "User"} 💙`;
    $schedule.innerText = localStorage.getItem(scheduleKey) || "";
    $weeklyReportOutput.innerText = localStorage.getItem(weeklyReportKey) || "";
    $stressScoreOutput.innerText = localStorage.getItem(stressScoreKey) || "";

    let breathingSource = null;
    let weeklyReportReqId = 0;

    function getStressTip(level) {
        switch (level) {
            case "calm":
                return "You seem calm. Keep your pace steady and start with the most important task.";
            case "normal":
                return "Feeling okay. Try 30–60 seconds of stretching between tasks to stay fresh.";
            case "stressed":
                return "You look stressed. Suggestion: take a 10-minute walk, drink water, then do 2 minutes of deep breathing (inhale 4s, exhale 6s).";
            case "very_stressed":
                return "High stress detected. Suggestion: pause now—5-minute slow breathing, light stretches, and a short walk. Then do the smallest task first.";
            default:
                return "";
        }
    }

    function renderStressTip() {
        const level = $stressLevel.value;
        $stressTip.innerText = getStressTip(level);
        localStorage.setItem(stressKey, level);
    }

    function inferScoreFromStressLevel(level) {
        if (level === "calm") return 25;
        if (level === "normal") return 45;
        if (level === "stressed") return 65;
        return 85;
    }

    function updateStressMeter(score) {
        if (!$stressMeterValue || !$stressMeterFill) return;
        const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
        $stressMeterValue.innerText = `${safeScore}/100`;
        $stressMeterFill.style.width = `${safeScore}%`;
        $stressMeterFill.classList.remove("meter-low", "meter-mid", "meter-high");
        if (safeScore < 40) $stressMeterFill.classList.add("meter-low");
        else if (safeScore < 70) $stressMeterFill.classList.add("meter-mid");
        else $stressMeterFill.classList.add("meter-high");
    }

    function renderBreakoutRecommendations() {
        if (!$breakoutCards) return;
        const cards = [
            {
                title: "Take a 5-minute walk",
                desc: "A short walk can reduce stress and improve focus.",
                action: "Start Walk"
            },
            {
                title: "Do breathing exercises",
                desc: "Try inhale 4s / exhale 6s for 2 minutes.",
                action: "Start Breathing"
            },
            {
                title: "Stretch your body",
                desc: "Release tension from neck, shoulders, and back.",
                action: "Start Stretching"
            }
        ];

        $breakoutCards.innerHTML = "";
        cards.forEach((card) => {
            const el = document.createElement("div");
            el.className = "break-card";
            el.innerHTML = `
                <h3>${card.title}</h3>
                <p>${card.desc}</p>
                <button type="button">${card.action}</button>
            `;
            const btn = el.querySelector("button");
            btn.addEventListener("click", () => {
                alert(`${card.action} session started.`);
            });
            $breakoutCards.appendChild(el);
        });
    }

    function renderProductivityChart() {
        const canvas = document.getElementById("productivityChart");
        if (!canvas || typeof Chart === "undefined") return;
        if (productivityChart) productivityChart.destroy();

        productivityChart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: dashboardMock.labels,
                datasets: [
                    {
                        label: "Tasks Completed",
                        data: dashboardMock.productivityTasks,
                        backgroundColor: "rgba(99, 102, 241, 0.75)",
                        borderRadius: 6
                    },
                    {
                        label: "Focus Hours",
                        data: dashboardMock.productivityHours,
                        backgroundColor: "rgba(34, 197, 94, 0.75)",
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: { enabled: true },
                    legend: { display: true }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function renderMoodChart() {
        const canvas = document.getElementById("moodChart");
        if (!canvas || typeof Chart === "undefined") return;
        if (moodChart) moodChart.destroy();

        moodChart = new Chart(canvas, {
            type: "line",
            data: {
                labels: dashboardMock.labels,
                datasets: [
                    {
                        label: "Mood Level",
                        data: dashboardMock.moodLevels,
                        borderColor: "#22c55e",
                        backgroundColor: "rgba(34, 197, 94, 0.12)",
                        borderWidth: 3,
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: { enabled: true },
                    legend: { display: true }
                },
                scales: {
                    y: {
                        min: 1,
                        max: 10,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    const savedStress = localStorage.getItem(stressKey);
    if (savedStress) $stressLevel.value = savedStress;
    renderStressTip();
    updateStressMeter(inferScoreFromStressLevel($stressLevel.value));
    renderBreakoutRecommendations();
    renderProductivityChart();
    renderMoodChart();

    function saveTasks() {
        localStorage.setItem(tasksKey, JSON.stringify(tasks));
    }

    function normalizeTasks() {
        tasks = (tasks || []).map(t => ({
            name: String(t?.name ?? "").trim(),
            time: String(t?.time ?? "").trim(),
            completed: Boolean(t?.completed)
        })).filter(t => t.name && t.time);
    }

    function renderProgress() {
        const total = tasks.length;
        const completed = tasks.reduce((acc, t) => acc + (t.completed ? 1 : 0), 0);
        $progressText.innerText = `✔ ${completed}/${total} tasks completed`;

        const blocks = 10;
        const filled = total === 0 ? 0 : Math.round((completed / total) * blocks);
        const bar = "█".repeat(filled) + "-".repeat(blocks - filled);
        $progressBarText.innerText = `[${bar}]`;
    }

    function parseMoodHistoryInput(raw) {
        if (!raw) return [];
        const parts = String(raw)
            .split(/[,\s]+/)
            .map(s => s.trim())
            .filter(Boolean);
        const values = parts
            .map(p => Number(p))
            .filter(n => Number.isFinite(n));
        // Clamp to 1..5 because the backend assumes 1-5 scale.
        return values.map(v => Math.min(5, Math.max(1, v)));
    }

    function stressLevelFromScore(score) {
        if (score <= 30) return "calm";
        if (score <= 50) return "normal";
        if (score <= 70) return "stressed";
        return "very_stressed";
    }

    function renderTasks() {
        // Use document fragments for efficient DOM updates
        $taskList.innerHTML = "";
        const fragment = document.createDocumentFragment();

        tasks.forEach((task, index) => {
            const div = document.createElement("div");
            div.className = "task-item";

            const left = document.createElement("div");
            left.style.display = "flex";
            left.style.alignItems = "center";
            left.style.gap = "8px";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(task.completed);
            checkbox.addEventListener("change", () => {
                tasks[index].completed = checkbox.checked;
                saveTasks();
                renderProgress();
            });

            const label = document.createElement("span");
            label.textContent = `${task.name} (${task.time}h)`;
            if (task.completed) label.style.textDecoration = "line-through";

            left.appendChild(checkbox);
            left.appendChild(label);

            const deleteBtn = document.createElement("span");
            deleteBtn.textContent = "❌";
            deleteBtn.style.color = "red";
            deleteBtn.style.cursor = "pointer";
            deleteBtn.addEventListener("click", () => deleteTask(index));

            div.appendChild(left);
            div.appendChild(deleteBtn);
            fragment.appendChild(div);
        });

        $taskList.appendChild(fragment);
        saveTasks();
        renderProgress();
    }

    function setBreathOrbPhase(phase, durationSec) {
        $breathOrb.classList.remove("inhale", "exhale");
        $breathOrb.classList.add(phase === "inhale" ? "inhale" : "exhale");
        const dur = Number(durationSec) > 0 ? Number(durationSec) : 1;
        $breathOrb.style.transitionDuration = `${dur}s`;
        $breathOrb.classList.remove("idle");
    }

    function resetBreathingUI() {
        if (breathingSource) breathingSource.close();
        breathingSource = null;

        $breathOrb.classList.remove("inhale", "exhale");
        $breathOrb.classList.add("idle");
        $breathOrb.style.transitionDuration = "0s";

        $breathPhaseText.innerText = "";
        $breathCountdownText.innerText = "";
        $breathInstruction.innerText = "";

        $breathStartBtn.style.display = "";
        $breathStopBtn.style.display = "none";
    }

    function getBreathingInstruction(phase) {
        if (phase === "inhale") return "Breathe in slowly through your nose.";
        return "Breathe out slowly through your mouth.";
    }

    function addTask(e) {
        e.preventDefault();
        const name = $taskInput.value.trim();
        const time = $taskTime.value.trim();

        if (!name || !time) {
            alert("Enter task and time");
            return;
        }

        tasks.push({ name, time });
        $taskInput.value = "";
        $taskTime.value = "";
        renderTasks();
    }

    function deleteTask(index) {
        tasks.splice(index, 1);
        renderTasks();
    }

    async function generateSchedule(e) {
        e.preventDefault();

        if (!tasks.length) {
            alert("Add tasks first!");
            return;
        }

        try {
            const res = await fetch(`${apiBase}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tasks })
            });
            const text = await res.text();
            if (!res.ok) {
                throw new Error(text || "Error generating timetable");
            }
            $schedule.innerText = text;
            localStorage.setItem(scheduleKey, text);
        } catch (err) {
            console.error(err);
            alert("Error generating timetable");
        }
    }

    // Prevent page reload on form submit (including Enter key).
    $taskForm.addEventListener("submit", addTask);
    $generateBtn.addEventListener("click", generateSchedule);
    $logoutBtn.addEventListener("click", () => {
        resetBreathingUI();
        localStorage.removeItem(userKey);
        localStorage.removeItem(tasksKey);
        localStorage.removeItem(scheduleKey);
        localStorage.removeItem(stressKey);
        localStorage.removeItem(stressScoreKey);
        localStorage.removeItem(weeklyReportKey);
        window.location.href = "login.html";
    });

    if ($stressLevel) {
        $stressLevel.addEventListener("change", () => {
            renderStressTip();
            updateStressMeter(inferScoreFromStressLevel($stressLevel.value));
        });
    }

    $calcStressBtn.addEventListener("click", async (e) => {
        if (e) e.preventDefault();
        const moodHistory = parseMoodHistoryInput($moodHistoryInput.value);
        const sleepHours = Number($sleepHoursInput.value);
        const completed = tasks.reduce((acc, t) => acc + (t.completed ? 1 : 0), 0);
        const total = tasks.length;
        const todayStr = localTodayISO();

        if (!moodHistory.length) {
            alert("Please enter mood history (1-5 numbers, comma separated).");
            return;
        }
        if (!Number.isFinite(sleepHours)) {
            alert("Please enter valid sleep hours.");
            return;
        }

        try {
            $stressScoreOutput.innerText = "Calculating stress score...";
            localStorage.setItem(stressScoreKey, $stressScoreOutput.innerText);
            const res = await fetch(`${apiBase}/stress/score`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    moodHistory,
                    sleepHours,
                    taskCompletion: { completed, total },
                    date: todayStr
                })
            });

            const text = await res.text();
            if (!res.ok) {
                $stressScoreOutput.innerText = text || "Unable to calculate stress score.";
                localStorage.setItem(stressScoreKey, $stressScoreOutput.innerText);
                return;
            }

            let data = null;
            try {
                data = JSON.parse(text);
            } catch {
                $stressScoreOutput.innerText = `Unexpected response from server:\n${text}`;
                localStorage.setItem(stressScoreKey, $stressScoreOutput.innerText);
                return;
            }
            if (data?.error) {
                $stressScoreOutput.innerText = String(data.error);
                localStorage.setItem(stressScoreKey, $stressScoreOutput.innerText);
                return;
            }
            const score = data.score;
            $stressScoreOutput.innerText =
                `Stress score: ${score}/100\n\n` +
                `Mood avg: ${data.moodAvg} (stress: ${data.moodStress})\n` +
                `Sleep: ${data.sleepHours}h (stress: ${data.sleepStress})\n` +
                `Task completion: ${data.completionRatio} (stress: ${data.completionStress})\n\n` +
                `Weights: mood 0.4, sleep 0.3, completion 0.3`;
            localStorage.setItem(stressScoreKey, $stressScoreOutput.innerText);

            // Auto-update the stress selector + tip so user sees actionable guidance.
            const suggested = stressLevelFromScore(score);
            $stressLevel.value = suggested;
            renderStressTip();
            updateStressMeter(score);
        } catch (err) {
            console.error(err);
            $stressScoreOutput.innerText =
                "Error calculating stress score.\n" +
                "Please make sure backend server is running on port 3000.";
            localStorage.setItem(stressScoreKey, $stressScoreOutput.innerText);
        }
    });

    $weeklyReportBtn.addEventListener("click", async () => {
        weeklyReportReqId += 1;
        const currentReqId = weeklyReportReqId;
        const endDate = localTodayISO();
        $weeklyReportOutput.innerText = `Generating report for ${endDate}…`;
        $weeklyReportBtn.disabled = true;

        try {
            const res = await fetch(
                `${apiBase}/stress/weekly-report?endDate=${encodeURIComponent(endDate)}&calendarDays=7`,
                { method: "GET", cache: "no-store" }
            );
            if (currentReqId !== weeklyReportReqId) return;
            const text = await res.text();
            if (!res.ok) {
                $weeklyReportOutput.innerText = text || "Error generating weekly report.";
                localStorage.setItem(weeklyReportKey, $weeklyReportOutput.innerText);
                return;
            }

            let report;
            try {
                report = JSON.parse(text);
            } catch {
                $weeklyReportOutput.innerText = text;
                localStorage.setItem(weeklyReportKey, $weeklyReportOutput.innerText);
                return;
            }

            $weeklyReportOutput.innerText = formatWeeklyReport(report);
            localStorage.setItem(weeklyReportKey, $weeklyReportOutput.innerText);
        } catch (err) {
            console.error(err);
            $weeklyReportOutput.innerText =
                "Error generating weekly report.\n" +
                "Make sure the backend is running: node server.js";
            localStorage.setItem(weeklyReportKey, $weeklyReportOutput.innerText);
        } finally {
            if (currentReqId === weeklyReportReqId) {
                $weeklyReportBtn.disabled = false;
            }
        }
    });

    $breathStartBtn.addEventListener("click", () => {
        // Avoid multiple active streams.
        if (breathingSource) breathingSource.close();

        const level = $stressLevel.value || "normal";

        $breathPhaseText.innerText = "";
        $breathCountdownText.innerText = "";
        $breathInstruction.innerText = "";
        $breathStartBtn.style.display = "none";
        $breathStopBtn.style.display = "";

        breathingSource = new EventSource(
            `${apiBase}/breathing/stream?stressLevel=${encodeURIComponent(level)}`
        );

        breathingSource.addEventListener("started", (e) => {
            const data = JSON.parse(e.data || "{}");
            $breathInstruction.innerText = "Get comfortable. Follow the inhale/exhale timing.";
            // Ensure orb is in a stable state before phaseChange arrives.
            $breathOrb.classList.remove("inhale", "exhale");
            $breathOrb.classList.add("idle");
            $breathOrb.style.transitionDuration = "0s";
        });

        breathingSource.addEventListener("phaseChange", (e) => {
            const data = JSON.parse(e.data || "{}");
            const phase = data.phase;
            const durationSec = data.nextDurationSec;
            const cycle = data.cycle;

            $breathPhaseText.innerText = `${phase === "inhale" ? "Inhale" : "Exhale"} (${durationSec}s)`;
            $breathCountdownText.innerText = `Seconds left: ${durationSec}`;
            $breathInstruction.innerText = `${getBreathingInstruction(phase)} Cycle ${cycle}.`;
            setBreathOrbPhase(phase, durationSec);
        });

        breathingSource.addEventListener("tick", (e) => {
            const data = JSON.parse(e.data || "{}");
            const remainingSec = data.remainingSec;
            if (typeof remainingSec === "number") {
                $breathCountdownText.innerText = `Seconds left: ${remainingSec}`;
            }
        });

        breathingSource.addEventListener("done", () => {
            $breathInstruction.innerText = "Done! Great job.";
            $breathOrb.classList.remove("inhale", "exhale");
            $breathOrb.classList.add("idle");
            $breathStartBtn.style.display = "";
            $breathStopBtn.style.display = "none";
            if (breathingSource) breathingSource.close();
            breathingSource = null;
        });

        breathingSource.onerror = () => {
            // If connection fails, close and reset.
            resetBreathingUI();
            alert("Breathing timer stopped (server not reachable).");
        };
    });

    $breathStopBtn.addEventListener("click", () => {
        resetBreathingUI();
    });

    normalizeTasks();
    renderTasks();
});