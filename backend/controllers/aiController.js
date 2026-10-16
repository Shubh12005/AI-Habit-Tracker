import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import AIInsight from "../models/AIInsight.js";

import {
  chatCompletion,
  SYSTEM_PROMPTS,
} from "../utils/aiService.js";

import {
  lastNDays,
  calcStreak,
  todayKey,
} from "../utils/dateHelpers.js";

const buildWeeklyContext = async (userId) => {
  const habits = await Habit.find({
    userId,
    isArchived: false,
  });

  const days = lastNDays(7);

  const logs = await HabitLog.find({
    userId,
    completedDate: {
      $gte: days[0],
      $lte: days[days.length - 1],
    },
  });

  const perHabit = habits.map((h) => {
    const completed = logs.filter(
      (l) => String(l.habitId) === String(h._id)
    ).length;

    return {
      name: h.name,
      category: h.category,
      frequency: h.frequency,
      completedDays: completed,
      targetDays: h.targetDays,
    };
  });

  return {
    days,
    perHabit,
  };
};
export const weeklyReport = async (req, res) => {
  try {
    const ctx = await buildWeeklyContext(req.user._id);

    if (!ctx.perHabit.length) {
      return res.json({
        content:
          "You don't have any active habits yet. Create your first habit to start tracking and I'll generate a personalized weekly report.",
      });
    }

    const userMsg = `
Here is the user's habit data for the past 7 days (${ctx.days[0]} to ${ctx.days[6]}):

${ctx.perHabit
  .map(
    (h) =>
      `- ${h.name} (${h.category}, ${h.frequency}): completed ${h.completedDays} of the past 7 days, target ${h.targetDays} days`
  )
  .join("\n")}

Please write the personalized weekly report now.
`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.weekly,
      user: userMsg,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "weekly",
      content,
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

export const suggestHabits = async (req, res) => {
  try {
    const {
      goals,
      productiveTime,
      struggles,
    } = req.body;

    const userMsg = `
User goals: ${goals || "not provided"}

Most productive time: ${productiveTime || "not provided"}

Past struggles:
${struggles || "none"}

Generate exactly 3 habit suggestions in JSON format.
`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.suggestion,
      user: userMsg,
    });

    let suggestions = [];

    try {
      const parsed = JSON.parse(
        content.replace(/```json|```/g, "").trim()
      );

      suggestions = parsed.suggestions || [];
    } catch {
      suggestions = [];
    }

    if (!suggestions.length) {
      suggestions = [
        {
          name: "10-minute morning walk",
          description:
            "Start the day with light movement and fresh air.",
          frequency: "daily",
          category: "Fitness",
          icon: "🚶",
          reason:
            "Low-friction habit to build consistency early in the day.",
        },
        {
          name: "Read 5 pages",
          description:
            "Short daily reading to build a learning routine.",
          frequency: "daily",
          category: "Learning",
          icon: "📚",
          reason:
            "Compounds into significant knowledge over time.",
        },
        {
          name: "2 minutes mindful breathing",
          description:
            "Pause and breathe to reset focus and reduce stress.",
          frequency: "daily",
          category: "Mindfulness",
          icon: "🧘",
          reason:
            "Tiny habit that fits into any schedule.",
        },
      ];
    }

    await AIInsight.create({
      userId: req.user._id,
      type: "suggestion",
      content: JSON.stringify(suggestions),
      meta: {
        goals,
        productiveTime,
        struggles,
      },
    });

    res.json({
      suggestions,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

export const recoveryPlan = async (req, res) => {
  try {
    const { habitName, missedDays = 1 } = req.body;

    const userMsg = `
The user missed "${habitName}" for ${missedDays} day(s).

Create a practical 3-day recovery plan.

The response should:
- Encourage the user without guilt.
- Focus on restarting instead of perfection.
- Give one simple task for each day.
- End with one motivational sentence.
`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.recovery,
      user: userMsg,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "recovery",
      content,
      meta: {
        habitName,
        missedDays,
      },
    });

    res.json({
      content,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

export const chatAnalysis = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    const habits = await Habit.find({
      userId: req.user._id,
      isArchived: false,
    });

    const logs = await HabitLog.find({
      userId: req.user._id,
    }).sort({
      completedDate: -1,
    });

    const context = habits.map((habit) => {
      const habitLogs = logs.filter(
        (log) => String(log.habitId) === String(habit._id)
      );

      const keys = habitLogs.map((log) => log.completedDate);

      const { current, longest } = calcStreak(keys);

      return {
        name: habit.name,
        category: habit.category,
        frequency: habit.frequency,
        targetDays: habit.targetDays,
        totalCompletions: habitLogs.length,
        currentStreak: current,
        longestStreak: longest,
      };
    });

    const prompt = `
User habit data:

${JSON.stringify(context, null, 2)}

User question:

${message}
`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.chat,
      user: prompt,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "chat",
      content,
      meta: {
        question: message,
      },
    });

    res.json({
      content,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

export const morningMotivation = async (req, res) => {
  try {
    const habits = await Habit.find({
      userId: req.user._id,
      isArchived: false,
    });

    const today = todayKey();

    const completedToday = await HabitLog.find({
      userId: req.user._id,
      completedDate: today,
    });

    const totalHabits = habits.length;
    const completedCount = completedToday.length;
    const remaining = totalHabits - completedCount;

    const prompt = `
Today's progress:

Total habits: ${totalHabits}

Completed today: ${completedCount}

Remaining today: ${remaining}

Generate a short morning motivation message (2–4 sentences).

Requirements:
- Positive and encouraging.
- Mention today's progress.
- Encourage completing the remaining habits.
- Keep it concise.
`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.morning,
      user: prompt,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "morning",
      content,
      meta: {
        totalHabits,
        completedCount,
        remaining,
      },
    });

    res.json({
      content,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};