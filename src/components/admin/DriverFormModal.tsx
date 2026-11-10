import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react'
import type { Profile } from '../../types'
import {
  createDriver,
  updateProfileAsAdmin,
  type CreateDriverInput,
} from '../../services/drivers'
import { getErrorMessage } from '../../utils/errors'
import { Alert, Field, Input, Modal } from '../common/ui'
import { Button } from '../common/Button'
import { useToast } from '../../contexts/ToastContext'

interface DriverFormValues extends CreateDriverInput {
  confirmPassword: string
}

export function DriverFormModal({
  open,
  driver,
  onClose,
  onSaved,
}: {
  open: boolean
  driver: Profile | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = Boolean(driver)
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DriverFormValues>()

  useEffect(() => {
    if (!open) return
    setFormError(null)
    reset({
      fullName: driver?.full_name ?? '',
      email: driver?.email ?? '',
      phone: driver?.phone ?? '',
      password: '',
      confirmPassword: '',
    })
  }, [open, driver, reset])

  const password = watch('password')

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    setFormError(null)
    try {
      if (driver) {
        await updateProfileAsAdmin(driver.id, {
          full_name: values.fullName.trim(),
          phone: values.phone.trim() || null,
        })
        toast.success('Driver information updated.')
      } else {
        await createDriver({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          password: values.password,
        })
        toast.success('Driver account created securely.')
      }
      onSaved()
      onClose()
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit driver' : 'Create driver account'}
      description={
        isEditing
          ? 'Update the driver’s contact details. Login access is unchanged.'
          : 'Creates a driver login with the admin-only database function. You will stay signed in.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSubmit()}
            loading={saving}
            icon={
              isEditing ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )
            }
          >
            {isEditing ? 'Save changes' : 'Create driver'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <Field
          label="Full name"
          htmlFor="driver-name"
          error={errors.fullName?.message}
          required
        >
          <Input
            id="driver-name"
            placeholder="Pedro Santos"
            {...register('fullName', {
              required: 'Driver name is required.',
              minLength: {
                value: 2,
                message: 'Enter at least 2 characters.',
              },
            })}
          />
        </Field>

        <Field
          label="Email address"
          htmlFor="driver-email"
          error={errors.email?.message}
          hint={isEditing ? 'Email addresses are managed through Supabase Auth.' : undefined}
          required={!isEditing}
        >
          <Input
            id="driver-email"
            type="email"
            placeholder="driver@example.com"
            disabled={isEditing}
            {...register('email', {
              required: isEditing ? false : 'Email is required.',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address.',
              },
            })}
          />
        </Field>

        <Field
          label="Mobile number"
          htmlFor="driver-phone"
          error={errors.phone?.message}
        >
          <Input
            id="driver-phone"
            type="tel"
            placeholder="09XX XXX XXXX"
            {...register('phone', {
              pattern: {
                value: /^[0-9+()\-\s]{7,20}$/,
                message: 'Enter a valid contact number.',
              },
            })}
          />
        </Field>

        {!isEditing ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
              <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                <KeyRound className="h-3.5 w-3.5" />
                Share these credentials with the driver
              </p>
              <p className="mt-1">
                The password is never stored in the app database and can only be
                changed by creating a new account or through Supabase Auth.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Temporary password"
                htmlFor="driver-password"
                error={errors.password?.message}
                required
              >
                <Input
                  id="driver-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  {...register('password', {
                    required: 'A temporary password is required.',
                    minLength: {
                      value: 6,
                      message: 'Use at least 6 characters.',
                    },
                  })}
                />
              </Field>

              <Field
                label="Confirm password"
                htmlFor="driver-confirm"
                error={errors.confirmPassword?.message}
                required
              >
                <Input
                  id="driver-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  {...register('confirmPassword', {
                    required: 'Please confirm the password.',
                    validate: (value) =>
                      value === password || 'Passwords do not match.',
                  })}
                />
              </Field>
            </div>
          </>
        ) : null}
      </form>
    </Modal>
  )
}
