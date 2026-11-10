import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  ArrowRight,
  Droplets,
  Eye,
  EyeOff,
  MapPin,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Logo } from '../../components/common/Logo'
import { SetupNotice } from '../../components/common/SetupNotice'
import { Alert, Field, Input } from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../utils/errors'
import { ROLE_HOME } from '../../utils/constants'

interface LoginFormValues {
  email: string
  password: string
}

export function LoginPage() {
  const { signIn, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const profile = await signIn(values.email, values.password)
      toast.success(`Welcome back, ${profile.full_name || 'there'}!`)
      const redirectTo =
        (location.state as { from?: string } | null)?.from ??
        ROLE_HOME[profile.role]
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,166,248,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(14,116,144,0.4),transparent_45%)]" />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Refreshingly simple water delivery management.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            One station, three focused experiences: customers order, drivers
            deliver, and administrators keep everything running.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            <li className="flex items-start gap-3">
              <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
              19L purified water with exchange or new-container pricing.
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
              Road-distance based minimum orders and delivery scheduling.
            </li>
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
              Live delivery updates for the station, driver and customer.
            </li>
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4" />
          Protected by Supabase authentication and row-level security.
        </div>
      </div>

      <div className="flex flex-col">
        <SetupNotice />
        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Welcome back
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Sign in to your account
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Administrators, drivers and customers use this same secure sign-in
              page. You will be taken to the right dashboard automatically.
            </p>

            {!configured ? (
              <div className="mt-6">
                <Alert tone="warning" title="Supabase is not configured">
                  Add your project URL and anon key to the{' '}
                  <code className="rounded bg-amber-100 px-1">.env</code> file,
                  then restart the dev server.
                </Alert>
              </div>
            ) : null}

            {formError ? (
              <div className="mt-6">
                <Alert tone="error">{formError}</Alert>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
              <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email', {
                    required: 'Email is required.',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address.',
                    },
                  })}
                />
              </Field>

              <Field label="Password" htmlFor="password" error={errors.password?.message} required>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="pr-11"
                    {...register('password', {
                      required: 'Password is required.',
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={isSubmitting}
                disabled={!configured}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              New customer?{' '}
              <Link
                to="/signup"
                className="font-semibold text-brand-700 hover:text-brand-800"
              >
                Create an account
              </Link>
            </p>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
              <p className="font-semibold text-slate-700">Account access</p>
              <p className="mt-1">
                Customers can sign up here. Driver accounts are created by the
                administrator, and the administrator account is initialized
                during project setup.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
