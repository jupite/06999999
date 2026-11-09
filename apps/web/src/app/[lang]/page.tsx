import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";
import { ArrowUpRight, BookOpen, Camera, Code2, Moon, Feather, Sparkles } from "lucide-react";
import { MusicCard } from "@/components/music-provider";
export default async function Home() {
  const { t } = await getI18n();
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">A LITTLE CORNER OF MY UNIVERSE</span>
        <span className="preview-label">{t("previewSite")}</span>
      </div>
      <div className="home-top">
        <section className="panel profile">
          <div className="profile-heading">
            <div className="avatar">
              <Moon size={32} />
            </div>
            <div>
              <span className="eyebrow">HELLO, WORLD</span>
              <h1>
                {t("homeHeading")}
                <span>{t("period")}</span>
              </h1>
            </div>
          </div>
          <p className="profile-copy">
            {t("profileLineOne")}
            <br />
            {t("profileLineTwo")}
          </p>
          <div className="profile-bottom">
            <div className="profile-stats">
              <LocaleLink href="/articles">
                <b>{t("articles")}</b>
                <span>{t("articleBlurb")}</span>
              </LocaleLink>
              <LocaleLink href="/projects">
                <b>{t("projects")}</b>
                <span>{t("projectBlurb")}</span>
              </LocaleLink>
              <LocaleLink href="/photos">
                <b>{t("photo")}</b>
                <span>{t("photoBlurb")}</span>
              </LocaleLink>
            </div>
            <LocaleLink className="round-button" href="/about" aria-label={t("learnAboutSite")}>
              <ArrowUpRight size={20} />
            </LocaleLink>
          </div>
        </section>
        <MusicCard />
      </div>
      <div className="quote-bar">
        <span className="line-mark" />
        <p>{t("homeQuote")}</p>
        <Sparkles size={17} />
      </div>
      <div className="bento">
        <LocaleLink href="/articles" className="panel feature-card article-card">
          <div className="orbital-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <span>記録</span>
          </div>
          <div className="feature-text">
            <span className="pill">WORDS & THOUGHTS</span>
            <h2>{t("articleFeature")}</h2>
            <p>{t("articleFeatureText")}</p>
            <span className="card-action">
              {t("readArticles")} <ArrowUpRight size={16} />
            </span>
          </div>
        </LocaleLink>
        <LocaleLink href="/photos" className="panel photo-card">
          <div className="photo-decoration" aria-hidden="true" />
          <div>
            <span className="eyebrow">FRAGMENTS OF LIFE</span>
            <h2>{t("photoFeature")}</h2>
            <p>{t("photoFeatureText")}</p>
          </div>
          <Camera size={24} />
        </LocaleLink>
        <LocaleLink href="/projects" className="panel project-card">
          <div className="card-top">
            <Code2 size={24} />
            <ArrowUpRight size={18} />
          </div>
          <span className="eyebrow">IDEAS INTO REALITY</span>
          <h2>{t("projectFeature")}</h2>
          <p>{t("projectFeatureText")}</p>
          <span className="text-link">{t("exploreProjects")}</span>
        </LocaleLink>
        <LocaleLink href="/about" className="panel small-card">
          <div className="moon-badge">
            <Moon size={30} />
          </div>
          <h3>{t("themeHeading")}</h3>
          <p>
            {t("theme")}
            <br />
            {t("artInProgress")}
          </p>
        </LocaleLink>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2>{t("shareFavorites")}</h2>
        </div>
        <LocaleLink href="/write" className="button secondary">
          <Feather size={16} />
          {t("tryWriting")}
        </LocaleLink>
      </div>
      <div className="explore-grid">
        <LocaleLink className="panel explore-card" href="/friends">
          <Sparkles size={22} />
          <h3>{t("friendsFeature")}</h3>
          <p>{t("friendsFeatureText")}</p>
        </LocaleLink>
        <LocaleLink className="panel explore-card" href="/articles">
          <BookOpen size={22} />
          <h3>{t("writingFeature")}</h3>
          <p>{t("writingFeatureText")}</p>
        </LocaleLink>
        <div className="panel explore-card">
          <Moon size={22} />
          <h3>{t("mascotFeature")}</h3>
          <p>{t("mascotFeatureText")}</p>
        </div>
      </div>
    </>
  );
}
