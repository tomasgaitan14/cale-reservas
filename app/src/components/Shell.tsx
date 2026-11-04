import { SignOut } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Brand } from './Brand.tsx'
import { SECONDARY_BUTTON } from './ui.ts'

interface ShellProps {
  onSignOut?: () => void
  children: ReactNode
  brand?: ReactNode
}

export function Shell({ onSignOut, children, brand }: ShellProps) {
  return (
    <div className="natural-shell mx-auto flex min-h-[100dvh] w-full max-w-[72.5rem] flex-col px-4 md:px-10">
      <header className="natural-shell-header flex items-center justify-between py-5 md:py-7">
        {brand ?? <Brand />}
        {onSignOut ? (
          <button type="button" className={SECONDARY_BUTTON} onClick={onSignOut}>
            <SignOut weight="bold" className="size-5" aria-hidden="true" />
            Salir
          </button>
        ) : null}
      </header>
      <main className="flex-1 pb-16 md:pb-24">{children}</main>
    </div>
  )
}
