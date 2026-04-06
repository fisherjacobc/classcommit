import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
	const datePart = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(date);

	const timePart = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "numeric",
		hour12: true,
	})
		.format(date)
		.replace(" AM", "am")
		.replace(" PM", "pm");

	return `${datePart} at ${timePart}`;
}
