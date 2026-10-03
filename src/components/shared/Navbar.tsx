import { getUserProfile } from '@/lib/actions/auth';
import { NavbarClient } from './NavbarClient';
import { MobileBottomNav } from './MobileBottomNav';

export async function Navbar() {
  const profileData = await getUserProfile();

  return (
    <>
      <NavbarClient
        user={profileData?.user || null}
        profile={profileData?.profile || null}
      />
      <MobileBottomNav role={profileData?.profile?.role ?? null} />
    </>
  );
}
