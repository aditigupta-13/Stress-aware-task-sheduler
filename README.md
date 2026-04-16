# 🧠 Stress-Aware Task Scheduler

A smart task scheduling system that adapts to user stress levels and optimizes productivity by balancing workload and well-being.

---

## 📌 Overview

The **Stress-Aware Task Scheduler** intelligently manages tasks by considering deadlines, priorities, and the user's mental stress level. It ensures efficient task completion while preventing burnout.

---

## 🚀 Features

* 📊 **Stress-Level Monitoring**
  Tracks user stress (manual input or sensor-based data)

* 🧩 **Adaptive Scheduling**
  Dynamically rearranges tasks based on stress levels

* ⏳ **Priority-Based Task Management**
  Handles tasks using priority queues and deadlines

* 🧘 **Break Recommendations**
  Suggests breaks when stress exceeds a threshold

* 🔄 **Real-Time Updates**
  Continuously updates schedule based on user condition

---

## 🛠️ Tech Stack

**Language:** C++ / Python

**Concepts Used:**

* Data Structures (Queues, Priority Queues)
* Greedy Algorithms
* Dynamic Scheduling
* (Optional) Machine Learning

---

## 📂 Project Structure

```
stress-aware-task-scheduler/
│── src/
│   ├── main.cpp / main.py
│   ├── scheduler.cpp / scheduler.py
│   ├── stress_monitor.cpp / stress_monitor.py
│
│── data/
│── README.md
│── requirements.txt
```

---

## ⚙️ How It Works

1. User inputs tasks with:

   * Deadline
   * Priority
   * Estimated time

2. User provides stress level

3. Scheduler:

   * Adjusts workload based on stress
   * Reschedules low-priority tasks
   * Inserts breaks if needed

4. Outputs an optimized schedule

---

## ▶️ Installation & Usage

### Python

```
git clone https://github.com/your-username/stress-aware-task-scheduler.git
cd stress-aware-task-scheduler
pip install -r requirements.txt
python main.py
```

### C++

```
g++ main.cpp -o scheduler
./scheduler
```

---

## 📸 Example

```
Input:
Task A - High Priority - Deadline: 2 hrs
Task B - Medium Priority - Deadline: 5 hrs
Stress Level: High

Output:
✔ Task A scheduled
⏸ Break added
➡ Task B postponed
```

---

## 🧠 Future Improvements

* Integration with wearable devices
* AI-based stress prediction
* GUI / Web dashboard
* Mobile app integration

---

## 💡 Inspiration

Managing productivity along with mental well-being is crucial. This project aims to bridge that gap using intelligent scheduling.
