import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import brandLogo from "../../assets/Roombaazi Final Logo.png";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <img src={brandLogo} alt="Roombaazi" />
            <p style={{ marginTop: "14px", maxWidth: 320 }}>
              Find verified rooms, PGs and flats without the broker hassle.
            </p>
          </div>

          <div className="footer-col">
            <h4>Explore</h4>
            <div className="footer-links">
              <Link to="/browse">Browse Rentals</Link>
              <Link to="/post-property">Post Property</Link>
              <Link to="/my-properties">My Listings</Link>
            </div>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <div className="footer-links">
              <a href="#about">About Us</a>
              <a href="#careers">Careers</a>
              <a href="#contact">Contact</a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Support</h4>
            <div className="footer-links">
              <a href="#help">Help Center</a>
              <a href="#safety">Safety Tips</a>
              <a href="#terms">Terms &amp; Privacy</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Roombaazi. All rights reserved.</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Home size={14} />
            Made for renters in India
          </span>
        </div>
      </div>
    </footer>
  );
}