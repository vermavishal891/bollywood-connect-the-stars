type BrandLogoVariant = 'primary' | 'gold' | 'neon' | 'icon' | 'footer';

const brandLogoSources: Record<BrandLogoVariant, string> = {
  primary: '/brand/04_web_navbar_footer/primary_holographic_star_reel_web_640px.png',
  gold: '/brand/04_web_navbar_footer/golden_star_connected_nodes_web_640px.png',
  neon: '/brand/04_web_navbar_footer/neon_glamour_primary_web_640px.png',
  icon: '/brand/03_app_icons/golden_star_connected_nodes_icon_192x192.png',
  footer: '/brand/04_web_navbar_footer/primary_holographic_star_reel_web_480px.png',
};

export default function BrandLogo({
  variant = 'primary',
  className = '',
  imageClassName = '',
}: {
  variant?: BrandLogoVariant;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={brandLogoSources[variant]}
        alt="Bollywood Connect"
        className={`block object-contain ${imageClassName}`}
      />
    </span>
  );
}
