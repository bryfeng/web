import type { AvatarProps, SkeletonProps } from '@chakra-ui/react'
import { Avatar, SkeletonCircle } from '@chakra-ui/react'
import { useState } from 'react'

export type LazyLoadAvatarProps = SkeletonProps & Pick<AvatarProps, 'src' | 'size'>
export const LazyLoadAvatar: React.FC<LazyLoadAvatarProps> = ({ src, size = 'sm', ...rest }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  return (
    <SkeletonCircle isLoaded={imageLoaded} width='auto' height='auto' {...rest}>
      <Avatar
        bg='transparent'
        loading='lazy'
        onLoad={() => setImageLoaded(true)}
        src={src}
        size={size}
        icon={<></>}
      />
    </SkeletonCircle>
  )
}
