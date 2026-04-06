"use client";
import type { Class } from "generated/prisma";
import { Home } from "lucide-react";
import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "~/components/ui/breadcrumb";

export default function Breadcrumbs({ classData }: { classData: Class }) {
    const pathname = usePathname();
    const pathSegments = pathname.split('/').filter((segment) => segment).filter((_segment, i) => i >= 2);

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink className="flex items-center gap-x-1" href={`/classes/${classData.id}`}><Home className="size-4" /> {classData.name}</BreadcrumbLink>
                </BreadcrumbItem>
                {pathSegments.map((segment, i) => (
                    i === pathSegments.length - 1 ? <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{segment.charAt(0).toUpperCase() + segment.slice(1)}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </> : <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink href={`/classes/${classData.id}/${pathname.split('/').filter((segment) => segment).filter((_segment, j) => j >= 2 && j <= i).join('/')}`}>{segment.charAt(0).toUpperCase() + segment.slice(1)}</BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}