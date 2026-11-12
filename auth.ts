import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";

const googleId = process.env.AUTH_GOOGLE_ID?.trim() ?? "";
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim() ?? "";
const appleId = process.env.AUTH_APPLE_ID?.trim() ?? "";
const appleSecret = process.env.AUTH_APPLE_SECRET?.trim() ?? "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(googleId && googleSecret ? [Google] : []),
    ...(appleId && appleSecret ? [Apple] : []),
  ],
  trustHost: true,
  session: { strategy: "jwt" },
});
