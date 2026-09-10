import { useState, useEffect } from 'react'

export function useProgressiveImage(
  placeholderSrc: string,
  src: string
): { src: string; loading: boolean } {
  const [imgSrc, setImgSrc] = useState(placeholderSrc)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const img = new Image()
    img.src = src

    img.onload = () => {
      setImgSrc(src)
      setLoading(false)
    }

    img.onerror = () => {
      setLoading(false)
    }

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])

  return { src: imgSrc, loading }
}
