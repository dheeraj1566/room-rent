import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import "./SiteFooter.css";
import brandLogo from "../../assets/Roombaazi Final Logo.png";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <img src={brandLogo} alt="Roombaazi" />
            <p className="site-footer-description">
              Find verified rooms, PGs and flats without the broker hassle.
            </p>
          </div>

          <div className="site-footer-col">
            <h4>Explore</h4>
            <div className="site-footer-links">
              <Link to="/browse">Browse Rentals</Link>
              <Link to="/post-property">Post Property</Link>
              <Link to="/my-properties">My Listings</Link>
            </div>
          </div>

          <div className="site-footer-col">
            <h4>Company</h4>
            <div className="site-footer-links">
              <a href="#about">About Us</a>
              <a href="#careers">Careers</a>
              <a href="#contact">Contact</a>
            </div>
          </div>

          <div className="site-footer-col">
            <h4>Support</h4>
            <div className="site-footer-links">
              <a href="#help">Help Center</a>
              <a href="#safety">Safety Tips</a>
              <a href="#terms">Terms &amp; Privacy</a>
            </div>
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© 2026 Roombaazi. All rights reserved.</span>
          <span className="site-footer-socials">
            <Home size={14} />
            Made for renters in India
          </span>
        </div>
      </div>
    </footer>
  );
}