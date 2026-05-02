'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/org')
  }, [router])

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <p className="text-zinc-400">Loading...</p>
    </div>
  )
}
