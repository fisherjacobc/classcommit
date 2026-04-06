"use client";

import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "~/components/ui/combobox";

export function GithubRepos({ githubRepos }: { githubRepos: string[] }) {
    return <Combobox id="githubRepo-1" name="githubRepo" items={githubRepos}>
        <ComboboxInput placeholder="username/myrepo" />
        <ComboboxContent>
            <ComboboxEmpty>No repositories found.</ComboboxEmpty>
            <ComboboxList>
                {(item) => (
                    <ComboboxItem key={item} value={item}>
                        {item}
                    </ComboboxItem>
                )}
            </ComboboxList>
        </ComboboxContent>
    </Combobox>
}