const { OAuth2Client } = require('google-auth-library');
const jwtUtils = require('../utils/jwt');

// Spy on jwtUtils methods BEFORE requiring authController
vi.spyOn(jwtUtils, 'sendTokenCookie').mockImplementation(() => {});
vi.spyOn(jwtUtils, 'clearTokenCookie').mockImplementation(() => {});

const { googleOAuth, googleOAuthCallback } = require('../controllers/authController');
const User = require('../models/User');

describe('Google OAuth Controller', () => {
  let req, res;

  beforeEach(() => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'create').mockResolvedValue({});
    
    vi.spyOn(OAuth2Client.prototype, 'generateAuthUrl').mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth');
    vi.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: 'mock_id_token' } });
    vi.spyOn(OAuth2Client.prototype, 'setCredentials').mockImplementation(() => {});
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({ email: 'test@example.com', name: 'Test User', sub: '12345', email_verified: true })
    });

    jwtUtils.sendTokenCookie.mockClear();
    jwtUtils.clearTokenCookie.mockClear();

    req = { query: {}, cookies: {} };
    res = {
      redirect: vi.fn(),
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  describe('googleOAuth', () => {
    it('should set oauth_state cookie and redirect to Google', async () => {
      await googleOAuth(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'oauth_state',
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
      expect(res.redirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth');
    });
  });

  describe('googleOAuthCallback', () => {
    it('should reject if state is missing or mismatched', async () => {
      req.query = { code: 'mock_code', state: 'mismatched' };
      req.cookies = { oauth_state: 'different' };

      await googleOAuthCallback(req, res);
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=invalid_state'));
    });

    it('should reject if oauth_rejected', async () => {
      req.query = { error: 'access_denied' };
      await googleOAuthCallback(req, res);
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=oauth_rejected'));
    });

    it('should create new user if not exists', async () => {
      req.query = { code: 'mock_code', state: 'valid_state' };
      req.cookies = { oauth_state: 'valid_state' };

      User.create.mockResolvedValue({ _id: 'new_user_id', email: 'test@example.com' });

      await googleOAuthCallback(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        email: 'test@example.com',
        authProvider: 'google',
        googleId: '12345'
      }));
      expect(jwtUtils.sendTokenCookie).toHaveBeenCalledWith(res, 'new_user_id');
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard'));
    });

    it('should link existing local user', async () => {
      req.query = { code: 'mock_code', state: 'valid_state' };
      req.cookies = { oauth_state: 'valid_state' };
      
      const mockUser = {
        _id: 'existing_id',
        email: 'test@example.com',
        authProvider: 'local',
        save: vi.fn()
      };
      User.findOne.mockResolvedValue(mockUser);

      await googleOAuthCallback(req, res);

      expect(mockUser.authProvider).toBe('linked');
      expect(mockUser.googleId).toBe('12345');
      expect(mockUser.save).toHaveBeenCalled();
      expect(jwtUtils.sendTokenCookie).toHaveBeenCalledWith(res, 'existing_id');
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard'));
    });

    it('should not modify authProvider if already linked or google', async () => {
      req.query = { code: 'mock_code', state: 'valid_state' };
      req.cookies = { oauth_state: 'valid_state' };
      
      const mockUser = {
        _id: 'existing_id',
        email: 'test@example.com',
        authProvider: 'linked',
        googleId: '12345',
        save: vi.fn()
      };
      User.findOne.mockResolvedValue(mockUser);

      await googleOAuthCallback(req, res);

      expect(mockUser.save).not.toHaveBeenCalled();
      expect(jwtUtils.sendTokenCookie).toHaveBeenCalledWith(res, 'existing_id');
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard'));
    });
  });
});
