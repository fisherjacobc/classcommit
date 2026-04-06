"use client";
import { useSearchParams } from "next/navigation";
import { memo } from "react";
import { toast } from "sonner";

export default memo(() => {
    const creationError = useSearchParams().get("creation-error");
    if (creationError) toast.error("Unable to create class", {
        description: creationError,
    })

    return <></>;
});