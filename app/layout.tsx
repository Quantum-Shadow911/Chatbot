import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "highlight.js/styles/github-dark.css";

export const metadata: Metadata = {
  title: "AI Chatbot",
  description: "A conversational AI assistant powered by the Mistral API.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

const THEME_BOOTSTRAP = `
try {
  var s = JSON.parse(localStorage.getItem("ai-chatbot:settings:v1") || "{}");
  var theme = s.theme === "light" || s.theme === "dark" ? s.theme : "system";
  var dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("light", !dark);
  var accent = typeof s.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(s.accent) ? s.accent : null;
  if (accent) {
    function h2r(x){return parseInt(x,16)/255}
    function toHsl(hex){var v=hex.replace("#","");var r=h2r(v.slice(0,2)),g=h2r(v.slice(2,4)),b=h2r(v.slice(4,6));var mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;if(mx===mn)return[0,0,l*100];var d=mx-mn,s=l>0.5?d/(2-mx-mn):d/(mx+mn),h;if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;return[h*360,s*100,l*100]}
    function toHex(hsl){var h=((hsl[0]%360)+360)%360,s=Math.min(100,Math.max(0,hsl[1]))/100,l=Math.min(100,Math.max(0,hsl[2]))/100,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,seg=Math.floor(h/60)%6,t=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][seg],o="#";for(var i=0;i<3;i++){o+=Math.round((t[i]+m)*255).toString(16).padStart(2,"0")}return o}
    function sh(hex,dl){var h=toHsl(hex);return toHex([h[0],h[1],Math.min(100,Math.max(0,h[2]+dl))])}
    function al(hex,a){var v=hex.replace("#","");return"rgba("+parseInt(v.slice(0,2),16)+","+parseInt(v.slice(2,4),16)+","+parseInt(v.slice(4,6),16)+","+a+")"}
    var r=document.documentElement.style;
    r.setProperty("--accent",accent);
    r.setProperty("--accent-strong",sh(accent,dark?-10:-14));
    r.setProperty("--accent-soft",sh(accent,dark?12:8));
    r.setProperty("--accent-text",dark?sh(accent,26,-5):sh(accent,-22,5));
    r.setProperty("--accent-border",al(accent,dark?0.4:0.45));
    r.setProperty("--accent-badge-bg",al(accent,dark?0.12:0.1));
    var li=sh(accent,8);
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+li+'"/><stop offset="1" stop-color="'+accent+'"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#020617"/><path d="M32 12c-11.05 0-20 7.83-20 17.5 0 5.51 2.93 10.43 7.5 13.68V54l8.09-4.44c1.42.29 2.89.44 4.41.44 11.05 0 20-7.83 20-17.5S43.05 12 32 12Z" fill="url(#g)"/><circle cx="23" cy="29.5" r="3" fill="#020617"/><circle cx="32" cy="29.5" r="3" fill="#020617"/><circle cx="41" cy="29.5" r="3" fill="#020617"/></svg>';
    document.querySelectorAll("link[rel='icon']:not([data-dynamic-accent])").forEach(function(el){el.remove()});
    var lk=document.createElement("link");lk.rel="icon";lk.type="image/svg+xml";lk.setAttribute("data-dynamic-accent","");lk.href="data:image/svg+xml,"+encodeURIComponent(svg);document.head.appendChild(lk);
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
