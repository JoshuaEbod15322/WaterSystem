import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { updateOwnProfile } from '../../services/auth'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/dates'
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Textarea,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'

export function CustomerProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name)
    setPhone(profile.phone ?? '')
    setAddress(profile.address ?? '')
  }, [profile])

  const handleSave = async () => {
    if (!profile) return
    if (fullName.trim().length < 2) {
      toast.error('Enter your full name.')
      return
    }
    if (!/^[0-9+()\-\s]{7,20}$/.test(phone.trim())) {
      toast.error('Enter a valid mobile number.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateOwnProfile(profile.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
      })
      await refreshProfile()
      toast.success('Profile updated.')
    } catch (saveError) {
      const message = getErrorMessage(saveError)
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Keep your contact details up to date so drivers can reach you."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
              {profile.full_name.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Personal information
              </h2>
              <p className="text-xs text-slate-400">
                Your email is managed by Supabase Authentication.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Full name" htmlFor="profile-name" required>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field label="Email address" htmlFor="profile-email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="profile-email"
                  value={profile.email}
                  disabled
                  className="pl-9"
                />
              </div>
            </Field>

            <Field
              label="Mobile number"
              htmlFor="profile-phone"
              hint="Drivers may call this number during delivery."
              required
            >
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="09XX XXX XXXX"
                  autoComplete="tel"
                  className="pl-9"
                />
              </div>
            </Field>

            <Field
              label="Default delivery address"
              htmlFor="profile-address"
              hint="Optional. You will still pin the exact location for each order."
            >
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Textarea
                  id="profile-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House number, street, barangay, city"
                  className="min-h-20 pl-9"
                />
              </div>
            </Field>

            <Button
              onClick={() => void handleSave()}
              loading={saving}
              icon={<Save className="h-4 w-4" />}
            >
              Save changes
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Account overview
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <UserRound className="h-4 w-4 text-slate-400" />
                Customer account
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Mail className="h-4 w-4 text-slate-400" />
                {profile.email}
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Member since {formatDateTime(profile.created_at)}
              </div>
            </div>
          </Card>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
            Your account role is fixed as <span className="font-semibold">Customer</span>.
            Role changes are protected by database row-level security and can
            only be performed by an administrator.
          </div>
        </div>
      </div>
    </div>
  )
}
