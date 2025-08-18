"use client"
import Image from "next/image";
import Link from 'next/link'

const Header = ({ darkMode }: { darkMode: boolean }) => {

  return (
    <div className="fixed top-0 w-full h-20 flex items-center z-10">
      <div className="relative lg:left-8 left-4">
        <Link href="/">
          <Image
            className="cursor-pointer"
            src={darkMode ? '/assets/logos/lightLogo.svg' : '/assets/logos/logo.svg'}
            width={150}
            height={150}
            alt="Randamu Logo"
          />
        </Link>
      </div>
    </div >
  );
};

export default Header;
