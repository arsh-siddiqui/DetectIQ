const { googleOAuth, googleOAuthCallback } = require("../controllers/authController");
const User = require("../models/User");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { sendTokenCookie } = require("../utils/jwt");

vi.mock("google-auth-library");
vi.mock("../models/User");
vi.mock("../utils/jwt");

describe("Google OAuth Controller", () => {
  let req, res, clientMock;

  beforeEach(() => {
    req = {
      query: {},
      cookies: {},
    };
    res = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    };
    clientMock = {
      generateAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth"),
      getToken: vi.fn().mockResolvedValue({ tokens: { id_token: "mock_id_token" } }),
      setCredentials: vi.fn(),
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({ email: "test@example.com", name: "Test User", sub: "12345", email_verified: true })
      })
    };
    OAuth2Client.mockImplementation(() => clientMock);
    vi.clearAllMocks();
  });

  describe("googleOAuth", () => {
    it("should set oauth_state cookie and redirect to Google", async () => {
      await googleOAuth(req, res);
      expect(res.cookie).toHaveBeenCalledWith("oauth_state", expect.any(String), expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth");
    });
  });

  describe("googleOAuthCallback", () => {
    it("should reject if state is missing or mismatched", async () => {
      req.query = { code: "mock_code", state: "different_state" };
      req.cookies = { oauth_state: "saved_state" };
      await googleOAuthCallback(req, res);
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("error=invalid_state"));
    });

    it("should reject if oauth_rejected", async () => {
      req.query = { error: "access_denied" };
      await googleOAuthCallback(req, res);
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("error=oauth_rejected"));
    });

    it("should create new user if not exists", async () => {
      req.query = { code: "mock_code", state: "saved_state" };
      req.cookies = { oauth_state: "saved_state" };
      
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ _id: "new_user_id", email: "test@example.com" });

      await googleOAuthCallback(req, res);
      
      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        email: "test@example.com",
        authProvider: "google",
        googleId: "12345"
      }));
      expect(sendTokenCookie).toHaveBeenCalledWith(res, "new_user_id");
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });

    it("should link existing local user", async () => {
      req.query = { code: "mock_code", state: "saved_state" };
      req.cookies = { oauth_state: "saved_state" };
      
      const mockUser = { _id: "existing_id", authProvider: "local", save: vi.fn() };
      User.findOne.mockResolvedValue(mockUser);

      await googleOAuthCallback(req, res);
      
      expect(mockUser.authProvider).toBe("linked");
      expect(mockUser.googleId).toBe("12345");
      expect(mockUser.save).toHaveBeenCalled();
      expect(sendTokenCookie).toHaveBeenCalledWith(res, "existing_id");
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });

    it("should not modify authProvider if already linked or google", async () => {
      req.query = { code: "mock_code", state: "saved_state" };
      req.cookies = { oauth_state: "saved_state" };
      
      const mockUser = { _id: "existing_id", authProvider: "linked", save: vi.fn() };
      User.findOne.mockResolvedValue(mockUser);

      await googleOAuthCallback(req, res);
      
      expect(mockUser.save).not.toHaveBeenCalled();
      expect(sendTokenCookie).toHaveBeenCalledWith(res, "existing_id");
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    });
  });
});
