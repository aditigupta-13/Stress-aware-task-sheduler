import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { Heart, Footprints, Wind, PersonStanding, Play } from "lucide-react";

const productivityData = [
  { day: "Mon", tasksCompleted: 5, focusHours: 3.2 },
  { day: "Tue", tasksCompleted: 7, focusHours: 4.1 },
  { day: "Wed", tasksCompleted: 4, focusHours: 2.8 },
  { day: "Thu", tasksCompleted: 8, focusHours: 4.5 },
  { day: "Fri", tasksCompleted: 6, focusHours: 3.9 },
  { day: "Sat", tasksCompleted: 3, focusHours: 2.4 },
  { day: "Sun", tasksCompleted: 5, focusHours: 3.0 }
];

const moodData = [
  { day: "Mon", mood: 6 },
  { day: "Tue", mood: 7 },
  { day: "Wed", mood: 5 },
  { day: "Thu", mood: 8 },
  { day: "Fri", mood: 7 },
  { day: "Sat", mood: 4 },
  { day: "Sun", mood: 6 }
];

const breakRecommendations = [
  {
    id: 1,
    title: "Take a 5-minute walk",
    subtitle: "Light movement boosts focus and lowers stress.",
    icon: Footprints,
    actionLabel: "Start Walk"
  },
  {
    id: 2,
    title: "Do breathing exercises",
    subtitle: "Try inhale 4s / exhale 6s for 2 minutes.",
    icon: Wind,
    actionLabel: "Start Breathing"
  },
  {
    id: 3,
    title: "Stretch your body",
    subtitle: "Release neck and shoulder tension.",
    icon: PersonStanding,
    actionLabel: "Start Stretching"
  }
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function DashboardCard({ title, children, className }) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-100",
        className
      )}
    >
      <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function ProductivityStatsGraph() {
  return (
    <DashboardCard title="Productivity Stats">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={productivityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="tasksCompleted"
              fill="#6366f1"
              radius={[8, 8, 0, 0]}
              name="Tasks Completed"
            />
            <Bar
              dataKey="focusHours"
              fill="#22c55e"
              radius={[8, 8, 0, 0]}
              name="Focus Hours"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}

function MoodGraph() {
  return (
    <DashboardCard title="Mood Trend (1-10)">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={moodData}>
            <defs>
              <linearGradient id="moodGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
              <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" />
            <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="mood"
              stroke="url(#moodGradient)"
              fill="url(#moodFill)"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Mood Level"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}

function StressMeter({ value = 68 }) {
  const clamped = Math.max(0, Math.min(100, value));
  const meterColor =
    clamped < 40 ? "bg-emerald-500" : clamped < 70 ? "bg-amber-400" : "bg-rose-500";

  return (
    <DashboardCard title="Stress Meter">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Current stress level</p>
          <span className="text-lg font-bold text-slate-800">{clamped}/100</span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all duration-500", meterColor)}
            style={{ width: `${clamped}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
        </div>
      </div>
    </DashboardCard>
  );
}

function HeartbeatMeter({ bpm = 78 }) {
  return (
    <DashboardCard title="Heartbeat Meter">
      <div className="flex h-40 items-center justify-center gap-4 rounded-xl bg-slate-50">
        <Heart className="h-10 w-10 animate-pulse fill-rose-500 text-rose-500" />
        <div>
          <p className="text-3xl font-bold text-slate-800">{bpm} BPM</p>
          <p className="text-sm text-slate-500">Real-time heart rhythm</p>
        </div>
      </div>
    </DashboardCard>
  );
}

function BreakRecommendationCard({ recommendation }) {
  const Icon = recommendation.icon;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-medium text-slate-800">{recommendation.title}</h3>
          <p className="text-sm text-slate-600">{recommendation.subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
      >
        <Play className="h-4 w-4" />
        {recommendation.actionLabel}
      </button>
    </div>
  );
}

function BreakoutSessionRecommendations() {
  return (
    <DashboardCard title="Breakout Session Recommendations" className="md:col-span-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {breakRecommendations.map((item) => (
          <BreakRecommendationCard key={item.id} recommendation={item} />
        ))}
      </div>
    </DashboardCard>
  );
}

export default function ProductivityWellnessDashboard() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Productivity & Wellness Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track focus, mood, stress, and recovery in one place.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ProductivityStatsGraph />
          <MoodGraph />
          <StressMeter value={68} />
          <HeartbeatMeter bpm={78} />
          <BreakoutSessionRecommendations />
        </div>
      </div>
    </main>
  );
}
