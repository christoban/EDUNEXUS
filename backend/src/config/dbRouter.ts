import mongoose from "mongoose";

/**
 * Gestionnaire des connexions dynamiques MongoDB
 * - Maintient un cache des connexions par école
 * - Route les requêtes vers la bonne base selon le contexte utilisateur
 */

type SchoolConnectionCache = {
  [schoolId: string]: mongoose.Connection;
};

class DatabaseRouter {
  private masterConnection: mongoose.Connection | null = null;
  private schoolConnections: SchoolConnectionCache = {};

  /**
   * Initialise la connexion MASTER (base centrale)
   */
  async initMasterDB(masterUrl: string): Promise<mongoose.Connection> {
    if (this.masterConnection && this.masterConnection.readyState === 1) {
      return this.masterConnection;
    }

    try {
      const masterConn = mongoose.createConnection(masterUrl);
      await masterConn.asPromise();
      console.log(`[MASTER DB] Connected: ${masterConn.db?.databaseName || "unknown"}`);
      this.masterConnection = masterConn;
      return masterConn;
    } catch (error) {
      console.error(`[MASTER DB] Connection failed:`, error);
      throw error;
    }
  }

  /**
   * Obtient la MASTER connection
   */
  getMasterConnection(): mongoose.Connection {
    if (!this.masterConnection || this.masterConnection.readyState !== 1) {
      throw new Error("Master DB not initialized");
    }
    return this.masterConnection;
  }

  /**
   * Récupère ou crée une connexion dynamique vers la base d'une école
   * @param schoolId - ID de l'école (depuis token JWT)
   * @param dbConnectionString - Connection string MongoDB
   */
  async getSchoolConnection(
    schoolId: string,
    dbConnectionString: string
  ): Promise<mongoose.Connection> {
    // Retourne depuis cache si déjà connectée et active
    if (this.schoolConnections[schoolId]) {
      const cached = this.schoolConnections[schoolId];
      if (cached.readyState === 1) {
        return cached;
      } else {
        // Connection morte, nettoie le cache
        delete this.schoolConnections[schoolId];
      }
    }

    try {
      const schoolConn = mongoose.createConnection(dbConnectionString);
      await schoolConn.asPromise();
      console.log(
        `[SCHOOL DB] Connected for school ${schoolId}: ${schoolConn.db?.databaseName || "unknown"}`
      );
      this.schoolConnections[schoolId] = schoolConn;
      return schoolConn;
    } catch (error) {
      console.error(
        `[SCHOOL DB] Connection failed for school ${schoolId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Ferme une connexion d'école spécifique
   */
  async closeSchoolConnection(schoolId: string): Promise<void> {
    if (this.schoolConnections[schoolId]) {
      await this.schoolConnections[schoolId].close();
      delete this.schoolConnections[schoolId];
      console.log(`[SCHOOL DB] Closed connection for school ${schoolId}`);
    }
  }

  /**
   * Ferme TOUTES les connexions
   */
  async closeAllConnections(): Promise<void> {
    // Ferme toutes les connexions d'écoles
    for (const schoolId of Object.keys(this.schoolConnections)) {
      await this.closeSchoolConnection(schoolId);
    }

    // Ferme la master
    if (this.masterConnection) {
      await this.masterConnection.close();
      this.masterConnection = null;
      console.log("[MASTER DB] Closed");
    }
  }

  /**
   * Stats des connexions actives
   */
  getConnectionStats() {
    return {
      masterReady: this.masterConnection?.readyState === 1,
      activeSchoolConnections: Object.keys(this.schoolConnections).length,
      schools: Object.keys(this.schoolConnections),
    };
  }
}

// Export singleton
export const dbRouter = new DatabaseRouter();
