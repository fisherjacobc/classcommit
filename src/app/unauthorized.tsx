import { Lock } from "lucide-react";
import ErrorPage from "./_components/error";

export default function Error401() {
    return <ErrorPage title="401" description="You're not authorized to access this page." Icon={<Lock className="h-20 w-auto" />} />
}