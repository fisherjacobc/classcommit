/** biome-ignore-all lint/suspicious/noArrayIndexKey: need i as key */
"use client";
import type { Assignment, Class } from "generated/prisma";
import { Home } from "lucide-react";
import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "~/components/ui/breadcrumb";

export default function Breadcrumbs({ classData, assignmentData }: { classData: Class; assignmentData?: Assignment }) {
    const pathname = usePathname();
    const pathSegments = pathname.split('/').filter((segment) => segment).filter((_segment, i) => i >= 2);

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink className="flex items-center gap-x-1" href={`/classes/${classData.id}`}><Home className="size-4" /> {classData.name}</BreadcrumbLink>
                </BreadcrumbItem>
                {pathSegments.map((segment, i) => {
                    const prev = pathSegments[i - 1];
                    const label = assignmentData && prev === 'assignments' ? assignmentData.name : (segment.charAt(0).toUpperCase() + segment.slice(1));
                    const href = `/classes/${classData.id}/${pathname.split('/').filter((seg) => seg).filter((_segment, j) => j >= 2 && j <= i).join('/')}`;
                    if (i === pathSegments.length - 1) {
                        return [
                            <BreadcrumbSeparator key={`sep-${i}`} />,
                            <BreadcrumbItem key={`item-${i}`}>
                                <BreadcrumbPage>{label}</BreadcrumbPage>
                            </BreadcrumbItem>
                        ];
                    }

                    return [
                        <BreadcrumbSeparator key={`sep-${i}`} />,
                        <BreadcrumbItem key={`item-${i}`}>
                            <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                        </BreadcrumbItem>
                    ];
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}