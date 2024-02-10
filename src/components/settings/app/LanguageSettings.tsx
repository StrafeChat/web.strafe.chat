import { useClient, useForceUpdate } from '@/hooks';
import { useTranslation } from 'react-i18next';

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

            <div className="card-wrapper">
                <div onClick={() => changeLanguage('en_US')} className={`card hoverable ${client?.user?.locale == "en-US" ? "!bg-[#21c45d]" : ""}`}>
                    <p className='text-center'>English (US)</p>
                </div>
                <div onClick={() => changeLanguage('fr_FR')} className={`card hoverable ${client?.user?.locale == "fr-FR" ? "!bg-[#21c45d]" : ""}`}>
                    <p className='text-center'>French</p>
                </div>
                <div onClick={() => changeLanguage('nl_NL')} className={`card hoverable ${client?.user?.locale == "nl-NL" ? "!bg-[#21c45d]" : ""}`}>
                    <p className='text-center'>Dutch</p>
                </div>
                <div onClick={() => changeLanguage('af_ZA')} className={`card hoverable ${client?.user?.locale == "af-ZA" ? "!bg-[#21c45d]" : ""}`}>
                    <p className='text-center'>Afrikaans</p>
                </div>
                <div onClick={() => changeLanguage('bn_BD')} className={`card hoverable ${client?.user?.locale == "bn-BD" ? "!bg-[#21c45d]" : ""}`}>
                    <p className='text-center'>Bengali</p>
                </div>
            </div>
        </>
    )
}