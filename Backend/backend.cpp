#include <iostream>
#include <fstream>
#include <vector>
#include <algorithm>
#include <sstream>
#include <cmath>
#include <iomanip>
#include <locale>
#include <cctype>

using namespace std;

struct Task {
    string name;
    int duration;
};

// Helper to trim whitespace (if filename lines have extra spaces)
string trim(const string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

static bool parseTaskLine(const string& rawLine, Task& outTask) {
    string line = trim(rawLine);
    if (line.empty()) return false;

    // Format: "<task name possibly with spaces> <duration>"
    // We treat the last whitespace-separated token as duration.
    size_t lastNonWs = line.find_last_not_of(" \t\r\n");
    if (lastNonWs == string::npos) return false;
    size_t lastWs = line.find_last_of(" \t", lastNonWs);
    if (lastWs == string::npos) return false; // no separator between name and duration

    string namePart = trim(line.substr(0, lastWs));
    string durationPart = trim(line.substr(lastWs + 1));
    if (namePart.empty() || durationPart.empty()) return false;

    try {
        size_t idx = 0;
        long long d = stoll(durationPart, &idx, 10);
        if (idx != durationPart.size()) return false;
        if (d <= 0 || d > 24 * 7) return false; // basic sanity bound
        outTask = Task{namePart, static_cast<int>(d)};
        return true;
    } catch (...) {
        return false;
    }
}

static string toUpper(string s) {
    for (char& c : s) {
        c = static_cast<char>(toupper(static_cast<unsigned char>(c)));
    }
    return s;
}

static bool startsWithTokenUpper(const string& line, const string& keywordUpper) {
    string t = toUpper(trim(line));
    return t.rfind(keywordUpper, 0) == 0; // prefix match
}

static vector<double> parseDoubleList(const string& raw) {
    // Accept numbers separated by comma and/or whitespace.
    vector<double> values;
    string token;
    for (char ch : raw) {
        if (ch == ',' || isspace(static_cast<unsigned char>(ch))) {
            token = trim(token);
            if (!token.empty()) {
                try {
                    values.push_back(stod(token));
                } catch (...) {
                    // ignore invalid token
                }
            }
            token.clear();
        } else {
            token.push_back(ch);
        }
    }
    token = trim(token);
    if (!token.empty()) {
        try {
            values.push_back(stod(token));
        } catch (...) {
            // ignore invalid token
        }
    }
    return values;
}

static vector<string> splitByPipe(const string& raw) {
    // Splits on the '|' character, preserving empty tokens.
    vector<string> parts;
    string token;
    for (char ch : raw) {
        if (ch == '|') {
            parts.push_back(token);
            token.clear();
        } else {
            token.push_back(ch);
        }
    }
    parts.push_back(token);
    return parts;
}

static double clamp01(double x) {
    return min(1.0, max(0.0, x));
}

static double clamp(double x, double lo, double hi) {
    return min(hi, max(lo, x));
}

static string fmt2(double x) {
    // Use classic locale to always output '.' decimal separator.
    ostringstream ss;
    ss.imbue(locale::classic());
    ss << fixed << setprecision(2) << x;
    return ss.str();
}

int main() {
    ifstream in("request.txt");
    ofstream out("response.txt");

    if (!in.is_open() || !out.is_open()) {
        cerr << "Error: could not open request.txt or response.txt.\n";
        return 1;
    }

    // Load all lines so we can support MODE switching.
    vector<string> lines;
    string line;
    while (getline(in, line)) lines.push_back(line);

    // Find first non-empty trimmed line.
    string firstNonEmpty;
    for (const auto& l : lines) {
        string t = trim(l);
        if (!t.empty()) {
            firstNonEmpty = t;
            break;
        }
    }

    string mode = "TIMETABLE";
    bool hasValidModeHeader = false;
    if (!firstNonEmpty.empty() && startsWithTokenUpper(firstNonEmpty, "MODE")) {
        istringstream iss(firstNonEmpty);
        string modeWord, modeName;
        iss >> modeWord >> modeName;
        if (!modeName.empty()) {
            string mn = toUpper(modeName);
            if (mn == "STRESS" || mn == "TIMETABLE" || mn == "WEEKLY") {
                mode = mn;
                hasValidModeHeader = true;
            }
        }
    }

    if (mode == "STRESS") {
        // Expected format:
        // MODE STRESS
        // MOODS 2,3,2,4,3
        // SLEEP 6.5
        // COMPLETED 2
        // TOTAL 5

        vector<double> moodHistory;
        bool hasSleep = false;
        double sleepHours = 0.0;
        bool hasCompleted = false;
        long long completed = 0;
        bool hasTotal = false;
        long long total = 0;

        for (const auto& rawLine : lines) {
            string t = trim(rawLine);
            if (t.empty()) continue;

            // Skip MODE line
            string tUpper = toUpper(t);
            if (tUpper.rfind("MODE", 0) == 0) continue;

            if (tUpper.rfind("MOODS", 0) == 0) {
                // take everything after keyword
                size_t pos = t.find_first_of(" \t");
                string rest = (pos == string::npos) ? "" : trim(t.substr(pos + 1));
                moodHistory = parseDoubleList(rest);
            } else if (tUpper.rfind("SLEEP", 0) == 0) {
                size_t pos = t.find_first_of(" \t");
                string rest = (pos == string::npos) ? "" : trim(t.substr(pos + 1));
                if (!rest.empty()) {
                    try {
                        sleepHours = stod(rest);
                        hasSleep = true;
                    } catch (...) {}
                }
            } else if (tUpper.rfind("COMPLETED", 0) == 0) {
                size_t pos = t.find_first_of(" \t");
                string rest = (pos == string::npos) ? "" : trim(t.substr(pos + 1));
                if (!rest.empty()) {
                    try {
                        completed = stoll(rest);
                        hasCompleted = true;
                    } catch (...) {}
                }
            } else if (tUpper.rfind("TOTAL", 0) == 0) {
                size_t pos = t.find_first_of(" \t");
                string rest = (pos == string::npos) ? "" : trim(t.substr(pos + 1));
                if (!rest.empty()) {
                    try {
                        total = stoll(rest);
                        hasTotal = true;
                    } catch (...) {}
                }
            }
        }

        auto invalidJson = [&](const string& msg) {
            out << "{\"error\":";
            out << "\"";
            for (char ch : msg) {
                if (ch == '\"' || ch == '\\') out << '\\';
                out << ch;
            }
            out << "\"}";
        };

        if (moodHistory.empty() || !hasSleep || !hasCompleted || !hasTotal) {
            invalidJson("Missing or invalid inputs for stress score");
            return 0;
        }
        if (total < 0 || completed < 0) {
            invalidJson("completed/total must be non-negative");
            return 0;
        }

        // Clamp inputs to reasonable ranges.
        for (double& m : moodHistory) {
            m = clamp(m, 1.0, 5.0);
        }
        sleepHours = clamp(sleepHours, 0.0, 24.0);

        const double MOOD_WEIGHT = 0.4;
        const double SLEEP_WEIGHT = 0.3;
        const double COMPLETION_WEIGHT = 0.3;

        double moodAvg = 0.0;
        for (double m : moodHistory) moodAvg += m;
        moodAvg /= static_cast<double>(moodHistory.size()); // 1..5

        double moodStress01 = clamp01((moodAvg - 1.0) / 4.0); // 1->0, 5->1
        double moodComponent = moodStress01 * 100.0 * MOOD_WEIGHT;
        int moodStress = static_cast<int>(llround(moodStress01 * 100.0));
        int moodComponentInt = static_cast<int>(llround(moodComponent));

        const double targetSleep = 8.0;
        double sleepStress01 = clamp01((targetSleep - sleepHours) / targetSleep); // less sleep => more stress
        double sleepComponent = sleepStress01 * 100.0 * SLEEP_WEIGHT;
        int sleepStress = static_cast<int>(llround(sleepStress01 * 100.0));
        int sleepComponentInt = static_cast<int>(llround(sleepComponent));

        double completionRatio = 0.0;
        if (total == 0) completionRatio = 0.0;
        else completionRatio = clamp01(static_cast<double>(completed) / static_cast<double>(total));

        double completionStress01 = clamp01(1.0 - completionRatio);
        double completionComponent = completionStress01 * 100.0 * COMPLETION_WEIGHT;
        int completionStress = static_cast<int>(llround(completionStress01 * 100.0));
        int completionComponentInt = static_cast<int>(llround(completionComponent));

        double rawScore = static_cast<double>(moodComponentInt + sleepComponentInt + completionComponentInt);
        int score = static_cast<int>(llround(clamp(rawScore, 0.0, 100.0)));

        // Build JSON to match frontend expectations.
        out << "{";
        out << "\"score\":" << score << ",";
        out << "\"components\":{";
        out << "\"mood\":" << moodComponentInt << ",";
        out << "\"sleep\":" << sleepComponentInt << ",";
        out << "\"completion\":" << completionComponentInt;
        out << "},";

        out << "\"moodAvg\":" << fmt2(moodAvg) << ",";
        out << "\"moodStress\":" << moodStress << ",";
        out << "\"sleepHours\":" << fmt2(sleepHours) << ",";
        out << "\"sleepStress\":" << sleepStress << ",";
        out << "\"completionRatio\":" << fmt2(completionRatio) << ",";
        out << "\"completionStress\":" << completionStress << ",";

        out << "\"formula\":{";
        out << "\"weights\":{\"mood\":0.4,\"sleep\":0.3,\"completion\":0.3},";
        out << "\"mapping\":{";
        out << "\"moodAvgToStress01\":\"(moodAvg - 1) / 4\",";
        out << "\"sleepStress01\":\"(8 - sleepHours) / 8\",";
        out << "\"completionStress01\":\"1 - completed/total\"";
        out << "}";
        out << "}";

        out << "}";
        return 0;
    }

    if (mode == "WEEKLY") {
        // Request format:
        // MODE WEEKLY
        // END <YYYY-MM-DD>
        // COUNT <N>

        string endDate = "9999-12-31";
        long long count = 7;

        for (const auto& rawLine : lines) {
            string t = trim(rawLine);
            if (t.empty()) continue;
            string tUpper = toUpper(t);

            if (tUpper.rfind("END", 0) == 0) {
                size_t pos = t.find_first_of(" \t");
                string rest = (pos == string::npos) ? "" : trim(t.substr(pos + 1));
                if (!rest.empty()) endDate = rest;
            } else if (tUpper.rfind("COUNT", 0) == 0) {
                size_t pos = t.find_first_of(" \t");
                string rest = (pos == string::npos) ? "" : trim(t.substr(pos + 1));
                if (!rest.empty()) {
                    try { count = stoll(rest); } catch (...) {}
                }
            }
        }

        auto invalidJson = [&](const string& msg) {
            out << "{\"error\":\"" << msg << "\"}";
        };

        ifstream hist("stress_history.txt");
        if (!hist.is_open()) {
            invalidJson("stress_history.txt not found. Record stress scores first.");
            return 0;
        }

        struct DayEntry {
            string date;
            int score = 0;
            double moodAvg = 0.0;
        };

        vector<DayEntry> filtered;
        string hline;
        while (getline(hist, hline)) {
            hline = trim(hline);
            if (hline.empty()) continue;

            vector<string> parts = splitByPipe(hline);
            if (parts.size() < 3) continue;

            string dateStr = trim(parts[0]);
            string scoreStr = trim(parts[1]);
            string moodAvgStr = trim(parts[2]);
            if (dateStr.empty()) continue;

            // Only include entries on/before endDate; ISO date compares lexicographically.
            if (!endDate.empty() && dateStr > endDate) continue;

            try {
                int score = stoi(scoreStr);
                double moodAvg = stod(moodAvgStr);
                filtered.push_back(DayEntry{dateStr, score, moodAvg});
            } catch (...) {
                // skip invalid lines
            }
        }

        if (filtered.empty()) {
            invalidJson("No stress history found for the given range.");
            return 0;
        }

        sort(filtered.begin(), filtered.end(), [](const DayEntry& a, const DayEntry& b) {
            return a.date < b.date;
        });

        if (count < 1) count = 1;
        size_t takeStart = filtered.size() > static_cast<size_t>(count)
            ? filtered.size() - static_cast<size_t>(count)
            : 0;

        vector<DayEntry> week(filtered.begin() + takeStart, filtered.end());
        if (week.empty()) {
            invalidJson("Not enough stress history to generate weekly report.");
            return 0;
        }

        // Prefix sums (DSA concept) for stress trend and averages.
        vector<long long> prefixScores;
        prefixScores.resize(week.size());

        double moodSum = 0.0;
        for (size_t i = 0; i < week.size(); ++i) {
            moodSum += week[i].moodAvg;
            prefixScores[i] = week[i].score + (i == 0 ? 0LL : prefixScores[i - 1]);
        }

        double avgMood = moodSum / static_cast<double>(week.size());

        vector<int> scores;
        scores.reserve(week.size());
        for (const auto& d : week) scores.push_back(d.score);

        int delta = scores.back() - scores.front();
        string trend = "stable";
        if (delta > 10) trend = "up";
        else if (delta < -10) trend = "down";

        // Sorting top stress days by score (DSA concept).
        vector<DayEntry> sortedByScore = week;
        sort(sortedByScore.begin(), sortedByScore.end(), [](const DayEntry& a, const DayEntry& b) {
            if (a.score != b.score) return a.score > b.score;
            return a.date > b.date;
        });

        size_t topN = min(static_cast<size_t>(3), sortedByScore.size());

        // Output JSON
        out << "{";
        out << "\"week\":{";
        out << "\"startDate\":\"" << week.front().date << "\",";
        out << "\"endDate\":\"" << week.back().date << "\",";
        out << "\"count\":" << week.size();
        out << "},";

        out << "\"avgMood\":" << fmt2(avgMood) << ",";

        out << "\"stressTrend\":{";
        out << "\"trend\":\"" << trend << "\",";

        out << "\"days\":[";
        for (size_t i = 0; i < week.size(); ++i) {
            if (i) out << ",";
            out << "{";
            out << "\"date\":\"" << week[i].date << "\",";
            out << "\"score\":" << week[i].score;
            out << "}";
        }
        out << "],";

        out << "\"cumulativeScores\":[";
        for (size_t i = 0; i < prefixScores.size(); ++i) {
            if (i) out << ",";
            out << prefixScores[i];
        }
        out << "]},";

        out << "\"topStressDays\":[";
        for (size_t i = 0; i < topN; ++i) {
            if (i) out << ",";
            out << "{";
            out << "\"date\":\"" << sortedByScore[i].date << "\",";
            out << "\"score\":" << sortedByScore[i].score;
            out << "}";
        }
        out << "]";

        out << "}";

        return 0;
    }

    // Default: TIMETABLE mode (existing behavior)
    vector<Task> tasks;
    for (const auto& rawLine : lines) {
        string t = trim(rawLine);
        if (t.empty()) continue;

        // Skip MODE header line only if it was actually a valid header.
        if (hasValidModeHeader && toUpper(t).rfind("MODE", 0) == 0) continue;

        Task tt;
        if (parseTaskLine(rawLine, tt)) tasks.push_back(tt);
    }

    if (tasks.empty()) {
        out << "No tasks found.\n";
        return 0;
    }

    // Sort by shortest duration first for "smart timetable"
    sort(tasks.begin(), tasks.end(), [](const Task& a, const Task& b) {
        return a.duration < b.duration;
    });

    int currentHour = 9; // Start time

    out << "---- SMART TIMETABLE ----\n\n";

    for (size_t i = 0; i < tasks.size(); ++i) {
        int endHour = currentHour + tasks[i].duration;
        out << tasks[i].name << " : "
            << currentHour << ":00 - "
            << endHour << ":00" << endl;
        currentHour = endHour;

        // Insert a break between tasks, but not after the last task
        if (i != tasks.size() - 1) {
            int breakEnd = currentHour + 1;
            out << "Break : "
                << currentHour << ":00 - "
                << breakEnd << ":00" << endl;
            currentHour = breakEnd;
        }
    }

    return 0;
}