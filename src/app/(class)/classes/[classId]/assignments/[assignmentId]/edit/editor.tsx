"use client";
import MonacoEditor, { useMonaco } from '@monaco-editor/react';
import darkTheme from './darkTheme';

export default function Editor() {
    useMonaco()?.editor.defineTheme("dark", darkTheme);

    return <MonacoEditor height="90vh" path={"Main.java"} defaultLanguage="java" defaultValue={`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World!");
    }
}`} theme="dark" />;
} 