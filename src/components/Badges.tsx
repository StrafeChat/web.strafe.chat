import {
    faBugSlash,
    faCode,
    faCrown,
    faGlobe,
    faHammer,
    faMoneyBillWave,
    faScrewdriverWrench,
    faStar,
  } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
  
  export default function Badges({ flags }: { flags: number }) {
    const badgeMap = [
      {
        key: 1 << 1,
        value: <FontAwesomeIcon title="Founder" icon={faCrown} className={"text-yellow-500"} />,
      },
      {
        key: 1 << 2,
        value: <FontAwesomeIcon title="Developer" icon={faCode} className={"text-green-500"} />,
      },
      {
        key: 1 << 3,
        value: <FontAwesomeIcon title="Admin" icon={faScrewdriverWrench}className={"text-red-500"}/>,
      },
      {
        key: 1 << 4,
        value: <FontAwesomeIcon title="Moderator" icon={faHammer} className={"text-blue-500"} />,
      },
      {
        key: 1 << 5,
        value: <FontAwesomeIcon title="Contributor" icon={faCode} className={"text-blue-600"} />,
      },
      {
        key: 1 << 6,
        value: <FontAwesomeIcon title="Translator" icon={faGlobe} className={"text-blue-400"} />,
      },
      {
        key: 1 << 7,
        value: <FontAwesomeIcon title="Bug Hunter" icon={faBugSlash} className={"text-red-600"} />,
      },
      {
        key: 1 << 8,
        value: (
          <FontAwesomeIcon title="Early Supporter" icon={faMoneyBillWave} className={"text-orange-500"} />
        ),
      },
      {
        key: 1 << 9,
        value: (
          <FontAwesomeIcon title="Supporter" icon={faMoneyBillWave} className={"text-green-600"} />
        ),
      },
      {
        key: 1 << 10,
        value: <FontAwesomeIcon title="Early Adopter" icon={faStar} className={"text-orange-600"} />,
      },
    ];
  
    const badges = badgeMap
      .filter((badge) => (flags & badge.key) !== 0)
      .map((badge) => badge.value);
  
    return <>{badges.map((badge, key) => <span key={key} id="">{badge}</span>)}</>;
  }