interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timeZone: string;
}

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function localDateTime(date: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function localTimeToUtc(
  date: Pick<LocalDateTime, "year" | "month" | "day">,
  time: string,
  timeZone: string,
) {
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let guess = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = localDateTime(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
    );
    const difference = target - observedAsUtc;
    if (difference === 0) {
      break;
    }
    guess += difference;
  }

  return new Date(guess);
}

function nextLocalDay(date: Pick<LocalDateTime, "year" | "month" | "day">) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function quietHoursStartAfter(now: Date, quietHours: QuietHours): Date | undefined {
  if (!quietHours.enabled) {
    return undefined;
  }

  const local = localDateTime(now, quietHours.timeZone);
  const minuteOfDay = local.hour * 60 + local.minute;
  const [startHour, startMinute] = quietHours.start.split(":").map(Number);
  const [endHour, endMinute] = quietHours.end.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  if (start === end) {
    throw new Error("Jam mulai dan selesai tenang tidak boleh sama.");
  }

  let endDate: Pick<LocalDateTime, "year" | "month" | "day"> | undefined;
  if (start < end && minuteOfDay >= start && minuteOfDay < end) {
    endDate = local;
  } else if (start > end && minuteOfDay >= start) {
    endDate = nextLocalDay(local);
  } else if (start > end && minuteOfDay < end) {
    endDate = local;
  }

  return endDate ? localTimeToUtc(endDate, quietHours.end, quietHours.timeZone) : undefined;
}
