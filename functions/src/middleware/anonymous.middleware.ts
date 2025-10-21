import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/environment';

export const allowAnonymousOrRoles = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization as string;
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token);
      
      // Check if anonymous user
      if (decodedToken.firebase.sign_in_provider === 'anonymous') {
        req.user = { uid: decodedToken.uid, role: 'anonymous', email: undefined };
        next();
        return;
      }
      
      // Check role-based access
      const userRole = decodedToken.role;
      if (allowedRoles.includes(userRole)) {
        req.user = { 
          uid: decodedToken.uid, 
          role: userRole, 
          email: decodedToken.email || undefined 
        };
        next();
        return;
      }
      
      res.status(403).json({ error: 'Insufficient permissions' });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
};
