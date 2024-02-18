import { useClient, useForceUpdate } from '@/hooks';
import { useTranslation } from 'react-i18next';

const languageNames: Record<string, string> = {
    'en_US': 'English (US)',
    'en_GB': 'English (UK)',
    'fr_FR': 'French',
    'af_ZA': 'Afrikaans',
    'bn_BD': 'Bengali',
    'sq_AL': 'Albanian',
    'ro_RO': 'Romanian',
    'es_ES': 'Spanish',
    'ar_SA': 'Arabic',
    'bg_BG': 'Bulgarian',
    'cs_CZ': 'Czech',
    'da_DK': 'Danish',
    'de_DE': 'German',
    'el_GR': 'Greek',
    'he_IL': 'Hebrew',
    'it_IT': 'Italian',
    'ja_JP': 'Japanese',
    'nl_NL': 'Dutch',
    'pt_PT': 'Portuguese',
    'ru_RU': 'Russian',
    'sv_SE': 'Swedish',
    'uk_UA': 'Ukrainian',
    'zh_CN': 'Chinese Simplified',
    'zh_TW': 'Chinese Traditional',
    'zh_HK': 'Chinese Traditional, Hong Kong',
    'az_AZ': 'Azerbaijani',
    'fil_PH': 'Filipino',
    'haw_US': 'Hawaiian',
    'en_SFN': 'Strafian',
};

export function LanguageSettings() {

    const { client } = useClient();
    const { i18n, t } = useTranslation();
    const forceUpdate = useForceUpdate();

    const availableLanguages = i18n.options?.supportedLngs || [];

    const changeLanguage = async (language: string) => {
        i18n.changeLanguage(language);
        const splitLang = language.split('_')
        await client?.user?.edit({ locale: splitLang[0] + '-' + splitLang[1] })
        forceUpdate()
    };

    return (
        <>
            <h1 className="title">Language</h1>
            <p>Select your language below.</p>

           <div className='locale'>
            <div className="card-wrapper">
                {availableLanguages.map(language => (
                    <div
                        key={language}
                        onClick={() => changeLanguage(language)}
                        className={`card hoverable ${client?.user?.locale === language.replace('_', '-') ? "!bg-[#21c45d]" : ""}`}
                    >
                        <p className='text-center'>{languageNames[language]}</p>
                    </div>
                ))}
            </div>
            </div>
        </>
    )
}
