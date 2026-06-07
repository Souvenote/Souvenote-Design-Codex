import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { BackButton, OptionsHeader, TileGrid } from "../components/Options";
import { PageChrome } from "../components/PageChrome";

const user = { name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" };
const credits = { images: 7, songs: 3 };
const totalCredits = credits.images + credits.songs;

export default function CreateOptionsPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="options" />
      <div className="opt-page">
        <Navbar loggedIn user={user} credits={credits} cartCount={0} />
        <OptionsHeader user={user} credits={totalCredits} lowBalance={false} />
        <TileGrid credits={totalCredits} />
        <BackButton href="/home" label="Back to home" />
        <Footer />
      </div>
    </div>
  );
}
