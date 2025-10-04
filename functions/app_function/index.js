const catalyst = require('zcatalyst-sdk-node');

module.exports = async (context, basicIO) => {
  try {
    const catalystApp = catalyst.initialize(context);
    const mode = basicIO.getArgument('mode');
    const ZCQL = catalystApp.zcql();

    // ============== LIST CHATS ===============
    if (mode === 'list_chats') {
      const query = 'SELECT ROWID, title FROM Chats ORDER BY CreatedTime ASC';
      const result = await ZCQL.executeZCQLQuery(query);
      const chats = Array.isArray(result) ? result.map(item => item.Chats) : [];
      basicIO.write(JSON.stringify(chats));
      context.close();
      return;
    }

    // ============== CREATE CHAT ===============
    if (mode === 'create_chat') {
      const title = basicIO.getArgument('title');
      if (!title || !title.trim()) {
        basicIO.write(JSON.stringify({ error: 'Title is required' }));
        context.close();
        return;
      }
      const table = catalystApp.datastore().table('Chats');
      const newChat = await table.insertRow({ title: title.trim() });
      basicIO.write(JSON.stringify(newChat));
      context.close();
      return;
    }

    // ============== DELETE CHAT ===============
    if (mode === 'delete_chat') {
      const chat_id = basicIO.getArgument('chat_id');
      if (!chat_id) {
        basicIO.write(JSON.stringify({ error: 'chat_id is required to delete chat' }));
        context.close();
        return;
      }

      // Delete chat from Catalyst
      await ZCQL.executeZCQLQuery(`DELETE FROM Chats WHERE ROWID = '${chat_id}'`);

      basicIO.write(JSON.stringify({ success: true }));
      context.close();
      return;
    }

    // ============== INVALID MODE ===============
    basicIO.write(JSON.stringify({ error: 'Invalid mode' }));
    context.close();

  } catch (err) {
    console.error('Backend error:', err);
    basicIO.write(JSON.stringify({ error: err.message || 'Internal Server Error', success: false }));
    context.close();
  }
};