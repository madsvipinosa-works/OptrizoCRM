"use client";

import { useActionState, useEffect, useRef, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { submitContactForm, type ContactState, type ContactFormValues } from "@/features/crm/actions/submit-inquiry";

const initialState: ContactState = {
    message: "",
    errors: {},
    success: false,
}

// Shared field styling. Error borders come from the Input's own aria-invalid styles.
const fieldClassName =
    "bg-background/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20";

interface ContactFormProps {
    className?: string;
}

type FieldName = keyof ContactFormValues;

interface FieldProps extends Omit<ComponentProps<"input">, "name" | "id"> {
    name: FieldName;
    label: string;
    state: ContactState;
    multiline?: boolean;
}

function Field({ name, label, state, multiline, className = "", ...inputProps }: FieldProps) {
    const error = state.errors?.[name]?.[0];
    const errorId = `${name}-error`;
    const shared = {
        id: name,
        name,
        defaultValue: state.values?.[name],
        "aria-required": true,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
    };

    return (
        <div className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            {multiline ? (
                <Textarea
                    {...shared}
                    placeholder={inputProps.placeholder}
                    className={`min-h-[150px] ${fieldClassName} ${className}`}
                />
            ) : (
                <Input {...shared} {...inputProps} className={`h-11 ${fieldClassName} ${className}`} />
            )}
            {error && (
                <p id={errorId} className="text-sm text-destructive dark:text-[color-mix(in_oklab,var(--destructive)_80%,white)]">{error}</p>
            )}
        </div>
    );
}

export function ContactForm({ className = "" }: ContactFormProps) {
    const [state, formAction, isPending] = useActionState(submitContactForm, initialState);
    const formRef = useRef<HTMLFormElement>(null);

    // After a failed submit, move focus to the first field that needs fixing.
    useEffect(() => {
        if (state.success || Object.keys(state.errors ?? {}).length === 0) return;
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, [state]);

    return (
        <Card className={`glass-card border-primary/20 w-full h-fit self-start ${className}`}>
            <CardHeader>
                <CardTitle>Send a Message</CardTitle>
                <CardDescription>We usually respond within 24 hours. All fields are required.</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    ref={formRef}
                    key={state.success ? "success-reset" : "active-form"}
                    action={formAction}
                    noValidate
                    className="space-y-6"
                >
                    <div aria-live="polite" role="status">
                        {state?.message && (
                            <div
                                className={`flex items-start gap-2 p-3 rounded-md text-sm text-foreground border ${state.success ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}
                            >
                                {state.success ? (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                                ) : (
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                                )}
                                <span>{state.message}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4">
                        <Field name="firstName" label="First name" state={state} placeholder="John" autoComplete="given-name" />
                        <Field name="lastName" label="Last name" state={state} placeholder="Doe" autoComplete="family-name" />
                    </div>

                    <Field
                        name="email"
                        label="Email"
                        state={state}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        spellCheck={false}
                        placeholder="john@example.com"
                    />

                    <Field name="subject" label="Subject" state={state} placeholder="Project Inquiry" />

                    <Field name="message" label="Message" state={state} multiline placeholder="Tell us about your project..." />

                    <Button type="submit" size="lg" disabled={isPending} className="w-full h-11 font-bold">
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Sending…
                            </>
                        ) : (
                            "Send Message"
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
