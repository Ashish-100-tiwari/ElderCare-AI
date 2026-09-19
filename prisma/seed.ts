/**
 * Seed data for the ElderCare AI demo.
 *
 * Idempotent: safe to run repeatedly. The senior is upserted and today's
 * schedule is rebuilt, so `prisma db seed` always leaves the database in the
 * same known-good demo state without duplicating rows.
 *
 * Relative imports (not the `@/` alias) so this runs under plain tsx.
 */

import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ScheduleStatus } from "../src/generated/prisma";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const SENIOR_ID = "senior-001";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local before seeding.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Today's date at a local wall-clock time. */
function todayAt(hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

const SCHEDULE: Array<{ hour: number; minute: number; activity: string; description: string }> = [
  { hour: 7, minute: 0, activity: "Wake Up", description: "Good morning — start the day slowly and drink a glass of water." },
  { hour: 7, minute: 30, activity: "Meditation", description: "Fifteen quiet minutes of breathing, with devotional music if you like." },
  { hour: 8, minute: 0, activity: "Breakfast", description: "A warm, light breakfast." },
  { hour: 10, minute: 30, activity: "Morning Walk", description: "A gentle walk in the garden — your favourite part of the morning." },
  { hour: 13, minute: 0, activity: "Lunch", description: "Lunch, followed by a little sitting rest." },
  { hour: 16, minute: 0, activity: "Rest", description: "Afternoon rest with devotional music." },
  { hour: 20, minute: 0, activity: "Relaxation", description: "A calm evening — light stretching or a chat with family." },
  { hour: 22, minute: 0, activity: "Sleep", description: "Time to wind down and sleep well." },
];

/** Sample chat history so the caregiver dashboard is not empty on first load. */
const SAMPLE_CONVERSATIONS: Array<{ hour: number; userMessage: string; aiResponse: string }> = [
  {
    hour: 8,
    userMessage: "Good morning.",
    aiResponse:
      "Good morning, Rajesh ji! I hope you slept well. Your breakfast is at 8 o'clock — shall we start the day gently?",
  },
  {
    hour: 10,
    userMessage: "I finished my walk in the garden.",
    aiResponse:
      "That is wonderful, Rajesh ji. The morning walk always suits you. Please sit and have some water now.",
  },
];

async function main() {
  console.log("Seeding ElderCare AI demo data…");

  const senior = await prisma.senior.upsert({
    where: { id: SENIOR_ID },
    update: {
      name: "Rajesh Sharma",
      age: 72,
      language: "Hindi",
      preferences: [
        "Likes morning walks",
        "Likes devotional music",
        "Prefers simple explanations",
        "Likes calm conversations",
      ],
      familyContactName: "Rahul Sharma (Son)",
      familyContactPhone: "+91 98765 43210",
    },
    create: {
      id: SENIOR_ID,
      name: "Rajesh Sharma",
      age: 72,
      language: "Hindi",
      preferences: [
        "Likes morning walks",
        "Likes devotional music",
        "Prefers simple explanations",
        "Likes calm conversations",
      ],
      familyContactName: "Rahul Sharma (Son)",
      familyContactPhone: "+91 98765 43210",
      // Left null so FAMILY_WEBHOOK_URL applies; set per-senior to override.
      familyWebhookUrl: null,
    },
  });

  // Rebuild today's schedule only — past days stay as history.
  const startOfDay = todayAt(0, 0);
  const startOfTomorrow = new Date(startOfDay);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const { count: removed } = await prisma.schedule.deleteMany({
    where: { seniorId: senior.id, scheduledTime: { gte: startOfDay, lt: startOfTomorrow } },
  });

  const now = new Date();
  await prisma.schedule.createMany({
    data: SCHEDULE.map((entry) => {
      const scheduledTime = todayAt(entry.hour, entry.minute);
      return {
        seniorId: senior.id,
        activity: entry.activity,
        description: entry.description,
        scheduledTime,
        // Activities already past are marked done, so the dashboard shows
        // realistic progress whenever the demo is run.
        status: scheduledTime < now ? ScheduleStatus.COMPLETED : ScheduleStatus.UPCOMING,
      };
    }),
  });

  if ((await prisma.conversation.count({ where: { seniorId: senior.id } })) === 0) {
    await prisma.conversation.createMany({
      data: SAMPLE_CONVERSATIONS.map((entry) => ({
        seniorId: senior.id,
        userMessage: entry.userMessage,
        aiResponse: entry.aiResponse,
        createdAt: todayAt(entry.hour, 5),
      })),
    });
  }

  const [scheduleCount, conversationCount] = await Promise.all([
    prisma.schedule.count({ where: { seniorId: senior.id } }),
    prisma.conversation.count({ where: { seniorId: senior.id } }),
  ]);

  console.log(`  senior:        ${senior.name} (${senior.id})`);
  console.log(`  schedule:      ${scheduleCount} activities for today (replaced ${removed})`);
  console.log(`  conversations: ${conversationCount}`);
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
