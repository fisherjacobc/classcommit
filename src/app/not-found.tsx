import { FileQuestionMark } from "lucide-react";
import ErrorPage from "./_components/error";

export default function Error404() {
    return <ErrorPage title="404" description="This page could not be found." Icon={<FileQuestionMark className="h-20 w-auto" />} />
}