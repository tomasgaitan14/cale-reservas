import { ArrowRight } from '@phosphor-icons/react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { TextField } from '../components/TextField.tsx'
import { PRIMARY_BUTTON } from '../components/ui.ts'
import { createBusiness, type Business } from '../lib/business.ts'
import type { BusinessFormErrors } from '../lib/business-errors.ts'
import { cleanSlugInput, MAX_SLUG_LENGTH, PAGE_ADDRESS_PREFIX, slugify } from '../lib/slug.ts'
import { normalizeWhatsapp } from '../lib/whatsapp.ts'

const MAX_NAME_LENGTH = 80

interface CreateBusinessScreenProps {
  onCreated: (business: Business) => void
}

export function CreateBusinessScreen({ onCreated }: CreateBusinessScreenProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  // Mientras la persona no toca la dirección, se arma sola con el nombre
  const [slugEdited, setSlugEdited] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [errors, setErrors] = useState<BusinessFormErrors>({})
  const [busy, setBusy] = useState(false)

  // El error de un campo deja de valer apenas la persona lo vuelve a tocar
  function clearErrors(...fields: (keyof BusinessFormErrors)[]) {
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([field]) => !fields.includes(field as keyof BusinessFormErrors))))
  }

  function changeName(value: string) {
    setName(value)
    clearErrors('name')
    if (!slugEdited) {
      setSlug(slugify(value))
      clearErrors('slug')
    }
  }

  function changeSlug(value: string) {
    setSlugEdited(true)
    setSlug(cleanSlugInput(value))
    clearErrors('slug')
  }

  function changeWhatsapp(value: string) {
    setWhatsapp(value)
    clearErrors('whatsapp')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    const result = await createBusiness({ name: name.trim(), slug, whatsapp: normalizeWhatsapp(whatsapp) })
    setBusy(false)
    if (result.ok) onCreated(result.business)
    else setErrors(result.errors)
  }

  return (
    <div className="grid items-start gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
      <div className="rise-in flex flex-col gap-5 pt-2 md:pt-10" style={{ '--i': 0 } as CSSProperties}>
        <p className="eyebrow">Paso 2 de 5 · Tu negocio</p>
        <h1 className="text-[1.875rem] md:text-[2.75rem] md:leading-[1.05]">
          Contanos de tu negocio<span className="text-muted">, son 3 datos.</span>
        </h1>
        <p className="max-w-[34ch] text-[1.1875rem] text-muted">
          Con esto armamos tu página. Después podés cambiar lo que quieras.
        </p>
      </div>

      <form
        onSubmit={submit}
        noValidate
        className="rise-in flex flex-col gap-6 rounded-[1.25rem] border border-line bg-surface p-6 md:p-8"
        style={{ '--i': 1 } as CSSProperties}
      >
        <TextField
          id="business-name"
          label="Nombre de tu negocio"
          placeholder="Peluquería Lucero"
          autoComplete="organization"
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={event => changeName(event.target.value)}
          error={errors.name}
          required
        />
        <TextField
          id="business-slug"
          label="Dirección de tu página"
          preview={`${PAGE_ADDRESS_PREFIX}${slug}`}
          placeholder="peluqueria-lucero"
          hint="Es el link que van a usar tus clientes para reservar. Solo letras, números y guiones."
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={MAX_SLUG_LENGTH}
          value={slug}
          onChange={event => changeSlug(event.target.value)}
          error={errors.slug}
          required
        />
        <TextField
          id="business-whatsapp"
          label="WhatsApp de tu negocio"
          placeholder="5493445550101"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          hint="Será público para que tus clientes te contacten por sus turnos. Con código de país y sin signos; para Argentina empieza con 549."
          value={whatsapp}
          onChange={event => changeWhatsapp(event.target.value)}
          error={errors.whatsapp}
          required
        />

        {errors.general ? (
          <p role="alert" className="rounded-[12px] bg-warn-bg p-3 text-[0.9375rem] font-medium text-warn">
            {errors.general}
          </p>
        ) : null}

        <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
          {busy ? 'Creando tu página…' : 'Crear mi página'}
          {busy ? null : <ArrowRight weight="bold" className="size-5" aria-hidden="true" />}
        </button>
      </form>
    </div>
  )
}
