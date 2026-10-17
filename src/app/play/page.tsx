import type { Metadata } from "next";
import PlayGame from "@/components/PlayGame";

export const metadata: Metadata = {
  title: "Play — earworm.",
};

export default function PlayPage() {
  return <PlayGame />;
}
