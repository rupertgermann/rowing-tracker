import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidElement, type ReactElement } from "react";
import { loadModule } from "./helpers/loadModule";

type FormProps = { children?: unknown; onSubmit?: (event: { preventDefault(): void }) => Promise<void> };

function findForm(node: unknown): ReactElement<FormProps> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const form = findForm(child);
      if (form) return form;
    }
  } else if (isValidElement<FormProps>(node)) {
    if (node.type === "form") return node;
    return findForm(node.props.children);
  }
}

for (const mailFails of [false, true]) {
  test(`registration requests verification before showing ${mailFails ? "delivery failure" : "email sent"}`, async () => {
    const state = ["Rower", "rower@example.test", "password123", "password123", false, ""];
    let stateIndex = 0;
    const pushed: string[] = [];
    let mailRequests = 0;
    const page = loadModule<{ default(): ReactElement }>("src/app/auth/register/page.tsx", {
      "react": { useState: () => [state[stateIndex++], () => {}] },
      "next/navigation": { useRouter: () => ({ push: (url: string) => pushed.push(url), refresh() {} }) },
      "next-auth/react": { signIn: async () => { mailRequests++; return mailFails ? { error: "EmailSignin" } : { error: null }; } },
      "next/link": { default: "a" },
      "@/components/ui/button": { Button: "button" },
      "lucide-react": { Loader2: "span", Waves: "span" },
    }, { fetch: async () => Response.json({ verificationRequired: true }) });

    const form = findForm(page.default());
    assert.ok(form?.props.onSubmit);
    await form.props.onSubmit({ preventDefault() {} });
    assert.equal(mailRequests, 1);
    assert.equal(pushed.length, 1);
    assert.equal(pushed[0].includes("delivery=failed"), mailFails);
  });
}
