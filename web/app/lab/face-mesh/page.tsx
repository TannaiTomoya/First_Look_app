import type { Metadata } from "next";
import LabClient from "./lab-client";

export const metadata: Metadata = {
  title: "顔メッシュ PoC | FirstLook Lab",
  robots: { index: false, follow: false },
};

export default function FaceMeshLabPage() {
  return <LabClient />;
}
