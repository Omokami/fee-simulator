"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ProjectLogo, ThemeSwitch } from "@stellar/design-system";
import { MainNav } from "@/components/MainNav";
import { NetworkSelector } from "@/components/NetworkSelector";
import { Hydration } from "@/components/Hydration";
import LogoSvg from "../../assets/logo2.svg";
import Image from "next/image";
import styles from './LayoutMain.module.css';

export interface ProjectLogo2Props {
  /** Project’s name */
  title?: string;
  /** Project’s website link @defaultValue `/` */
  link?: string;
}

/**
 * `ProjectLogo` contains the name of the project and its link and are displayed in the page header.
 */
export const ProjectLogo2: React.FC<ProjectLogo2Props> = ({
  title,
  link = "/",
}) => (
  <div className="ProjectLogo">
    <a href={link} rel="noreferrer noopener">
      {/* <Image src={LogoSvg} alt="Logo" width={10}/> */}
      {title ? <div className="ProjectLogo__title">{title}</div> : null}
    </a>
    {/* {title ? <div className="ProjectLogo__title">{title}</div> : null} */}
  </div>
);

// export const ProjectLogo3: React.FC<ProjectLogo2Props> = ({
//   title,
//   link = "/",
// }) => (
//   <div style={{ display: 'flex', alignItems: 'center', padding: '10px' }}>
//     <a href={link} rel="noreferrer noopener" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
//       <Image src={LogoSvg} alt="Logo" width={40} height={40} style={{ marginRight: '10px' }} />
//       {title ? (
//         <div style={{ fontSize: '16px', whiteSpace: 'nowrap' }}>
//           {title}
//         </div>
//       ) : null}
//     </a>
//   </div>
// );


export const ProjectLogo3: React.FC<ProjectLogo2Props> = ({
  title,
  link = "/",
}) => (
  <div className={styles.container}>
    <a href={link} rel="noreferrer noopener" className={styles.link}>
      <Image src={LogoSvg} alt="Logo" width={40} height={40} className={styles.logo} />
      {title && (
        <div className={styles.title}>{title}</div>
      )}
    </a>
  </div>
);


export const LayoutMain = ({ children }: { children: ReactNode }) => {
  return (
    <div className="LabLayout">
      <div>
        <div className="LabLayout__header">
          <header className="LabLayout__header__main">
            <ProjectLogo3
              title="FeeSimulator"
              link="/"
              // customAnchor={<Link href="/" prefetch={true} />}
            />
            <MainNav />

            <div className="LabLayout__header__settings">
              <Hydration>
                <ThemeSwitch storageKeyId="stellarTheme:Laboratory" />
              </Hydration>
              <NetworkSelector />
            </div>
          </header>
        </div>
      </div>

      <Hydration>{children}</Hydration>
    </div>
  );
};
