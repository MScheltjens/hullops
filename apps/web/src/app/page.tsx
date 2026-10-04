import { redirect } from "next/navigation";

// The order overview is the home page for now.
export default function Home() {
  redirect("/orders");
}
