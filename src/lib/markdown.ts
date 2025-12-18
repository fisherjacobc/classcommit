import { remark } from "remark";
import html from "remark-html";
import matter from "gray-matter";

export async function markdownToHtml(markdown: string) {
	// Use gray-matter to parse the post metadata section
	const matterResult = matter(markdown);

	// Use remark to convert markdown into HTML string
	const processedContent = await remark()
		.use(html)
		.process(matterResult.content);
	const contentHtml = processedContent.toString();

	// Combine the data with the contentHtml
	return {
		contentHtml,
		...matterResult.data,
	};
}
