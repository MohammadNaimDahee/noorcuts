import { SignUp } from "@clerk/nextjs";
import { NoorLogo } from "@/components/NoorLogo";

export default function SignUpPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 bg-[#0e0e1e]">
      <NoorLogo size={36} />
      <SignUp />
    </div>
  );
}
