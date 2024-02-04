import { useClient, useForceUpdate } from '@/hooks';
import { useTranslation } from 'react-i18next';

export function LanguageSettings() {

    const { client } = useClient();
    const { i18n } = useTranslation();
    const forceUpdate = useForceUpdate();

    const availableLanguages = i18n.options?.supportedLngs || [];

    console.log(availableLanguages);

    const changeLanguage = async (language: string) => {
        i18n.changeLanguage(language);
        const splitLang = language.split('_')
        await client?.user?.edit({ locale: splitLang[0] + '-' + splitLang[1] })
        forceUpdate()
    };

    return (
        <>
            <h1 className="title">Language</h1>

            <div className="card-wrapper">
                <div className={`card hoverable ${client?.user?.locale == "en-US" ? "!bg-red-500" : ""}`}>
                    <button onClick={() => changeLanguage('en_US')}>English (US)</button>
                </div>
                <div className={`card hoverable ${client?.user?.locale == "fr-FR" ? "!bg-red-500" : ""}`}>
                    <button onClick={() => changeLanguage('fr_FR')}>French</button>
                </div>
            </div>
        </>
    )
}