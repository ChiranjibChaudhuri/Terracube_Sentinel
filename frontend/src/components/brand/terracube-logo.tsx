import type { SVGProps } from 'react'

interface TerraCubeIconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number | string
}

export function TerraCubeIcon({ size = 32, className, ...props }: TerraCubeIconProps) {
  return (
    <svg
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={className}
      style={typeof size === 'string' ? { width: size, height: size } : undefined}
      {...props}
    >
      {/* Isometric Cube with multi-hazard variant colors */}
      <g transform="translate(60, 70) scale(8)">
        {/* Front face - Ocean/Water (Blue) */}
        <path d="M5.825 2.82l4.35 2.524v5.052L5.825 7.87V2.82z" fill="#0891B2" fillRule="evenodd" clipRule="evenodd"/>

        {/* Right face - Land/Earth (Green) */}
        <path d="M10.651 5.344v5.052L15 7.87V2.82l-4.349 2.524z" fill="#059669" fillRule="evenodd" clipRule="evenodd"/>

        {/* Left face - Atmosphere/Air (Purple) */}
        <path d="M1 0v5.05l4.349 2.527V2.526L1 0z" fill="#7B42BC" fillRule="evenodd" clipRule="evenodd"/>

        {/* Bottom face - Temperature/Heat (Orange/Red) */}
        <path d="M5.825 13.474L10.174 16v-5.051L5.825 8.423v5.051z" fill="#EA580C" fillRule="evenodd" clipRule="evenodd"/>
      </g>
    </svg>
  )
}
