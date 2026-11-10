import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  CheckCircle2,
  Droplets,
  Eye,
  EyeOff,
  MapPin,
  UserPlus,
} from "lucide-react";
import { SetupNotice } from "../../components/common/SetupNotice";
import { Alert, Field, Input } from "../../components/common/ui";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/errors";

interface SignupFormValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export function SignupPage() {
  const { signUp, configured } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>();

  const password = watch("password");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await signUp({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });

      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
        return;
      }

      toast.success("Your customer account is ready!");
      navigate("/customer", { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  if (confirmationSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Check your email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            We sent a confirmation link to your email address. Confirm it, then
            sign in to start ordering water.
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button size="lg">Go to sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex flex-col">
        <SetupNotice />
        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-md">
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Create your account
            </h1>

            {formError ? (
              <div className="mt-6">
                <Alert tone="error">{formError}</Alert>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <Field
                label="Full name"
                htmlFor="fullName"
                error={errors.fullName?.message}
                required
              >
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Juan Dela Cruz"
                  {...register("fullName", {
                    required: "Full name is required.",
                    minLength: {
                      value: 2,
                      message: "Enter your complete name.",
                    },
                  })}
                />
              </Field>

              <Field
                label="Email address"
                htmlFor="email"
                error={errors.email?.message}
                required
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register("email", {
                    required: "Email is required.",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address.",
                    },
                  })}
                />
              </Field>

              <Field
                label="Mobile number"
                htmlFor="phone"
                error={errors.phone?.message}
                hint="Used by the driver to contact you about your delivery."
                required
              >
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="09XX XXX XXXX"
                  {...register("phone", {
                    required: "Mobile number is required.",
                    pattern: {
                      value: /^[0-9+()\-\s]{7,20}$/,
                      message: "Enter a valid contact number.",
                    },
                  })}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Password"
                  htmlFor="password"
                  error={errors.password?.message}
                  required
                >
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Min. 6 characters"
                      className="pr-10"
                      {...register("password", {
                        required: "Password is required.",
                        minLength: {
                          value: 6,
                          message: "Use at least 6 characters.",
                        },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

                <Field
                  label="Confirm password"
                  htmlFor="confirmPassword"
                  error={errors.confirmPassword?.message}
                  required
                >
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    {...register("confirmPassword", {
                      required: "Please confirm your password.",
                      validate: (value) =>
                        value === password || "Passwords do not match.",
                    })}
                  />
                </Field>
              </div>

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={isSubmitting}
                disabled={!configured}
                icon={<UserPlus className="h-4 w-4" />}
              >
                {isSubmitting ? "Creating account…" : "Create customer account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-brand-700 hover:text-brand-800"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(56,166,248,0.35),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(14,116,144,0.4),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-center p-12">
          <div className="max-w-md">
            <h2 className="mt-6 text-3xl font-bold leading-tight text-white">
              Pure water, delivered on your schedule.
            </h2>
            <ul className="mt-8 space-y-5 text-sm text-slate-300">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                Pin your exact address and see the road distance from the
                station before ordering.
              </li>
              <li className="flex gap-3">
                <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                Choose between exchanging empty 19L containers or buying new
                ones.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                Pay securely online with Stripe test mode, or pay cash on
                delivery.
              </li>
            </ul>
            <p className="mt-10 text-xs text-slate-500">
              By creating an account you agree to provide accurate delivery
              details for your orders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
