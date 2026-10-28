"use client";
import NextLink from "next/link";
import {
  useRouter as useNextRouter,
  usePathname as useNextPathname,
} from "next/navigation";
import { createContext, useContext, type ComponentProps } from "react";
export const DemoContext = createContext<{ refresh: () => void } | null>(null);
export function useDemo() {
  return useContext(DemoContext);
}
function demoHref(href: string) {
  return href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/demo")
    ? `/demo${href === "/" ? "" : href}`
    : href;
}
export default function Link(props: ComponentProps<typeof NextLink>) {
  const demo = useDemo();
  return (
    <NextLink
      {...props}
      href={
        demo && typeof props.href === "string"
          ? demoHref(props.href)
          : props.href
      }
    />
  );
}
export function useRouter() {
  const router = useNextRouter();
  const demo = useDemo();
  return {
    ...router,
    push: (href: string) => router.push(demo ? demoHref(href) : href),
    refresh: () => (demo ? demo.refresh() : router.refresh()),
  };
}
export function usePathname() {
  const path = useNextPathname();
  const demo = useDemo();
  return demo ? path.replace(/^\/demo(?=\/|$)/, "") || "/" : path;
}
export function DownloadLink(props: ComponentProps<"a">) {
  const demo = useDemo();
  return (
    <a
      {...props}
      onClick={async (event) => {
        if (!demo || !props.href?.startsWith("/api/")) return;
        event.preventDefault();
        try {
          const { downloadDemoFile } = await import("@/lib/demo/engine");
          await downloadDemoFile(props.href);
        } catch (error) {
          window.alert((error as Error).message);
        }
      }}
    />
  );
}
